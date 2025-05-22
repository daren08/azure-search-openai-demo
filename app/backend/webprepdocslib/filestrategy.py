import os
import re
from enum import Enum
import traceback
from typing import Optional
import logging
from .blobmanager import BlobManager
from .embeddings import OpenAIEmbeddings
from .listfilestrategy import ListFileStrategy
from .pdfparser import PdfParser
from .searchmanager import SearchManager, Section
from .strategy import SearchInfo, Strategy
from .textsplitter import TextSplitter
import asyncio

import asyncpg
import json

from pdfminer.converter import PDFPageAggregator
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfpage import PDFPage
from pdfminer.utils import open_filename
from pdfminer.pdftypes import resolve1
from pdfminer.layout import LAParams, LTTextBox, LTTextLine, LTChar,LTPage
from pdfminer.high_level import extract_text

class DocumentAction(Enum):
    Add = 0
    Remove = 1
    RemoveAll = 2


class FileStrategy(Strategy):
    """
    Strategy for ingesting documents into a search service from files stored either locally or in a data lake storage account
    """

    def __init__(
        self,
        list_file_strategy: ListFileStrategy,
        blob_manager: BlobManager,
        pdf_parser: PdfParser,
        text_splitter: TextSplitter,
        document_action: DocumentAction = DocumentAction.Add,
        embeddings: Optional[OpenAIEmbeddings] = None,
        search_analyzer_name: Optional[str] = None,
        use_acls: bool = False,
        category: Optional[str] = None,
        users: Optional[str] = None,
        space: Optional[str] = None,
    ):
        self.list_file_strategy = list_file_strategy
        self.blob_manager = blob_manager
        self.pdf_parser = pdf_parser
        self.text_splitter = text_splitter
        self.document_action = document_action
        self.embeddings = embeddings
        self.search_analyzer_name = search_analyzer_name
        self.use_acls = use_acls
        self.category = category
        self.users = users
        self.space = space

    async def extractPDFFeatures(self, pdf_path, file_Id, split_pages_dicts):

        def extract_text_by_rect(page_layout, rect):
            """Extracts text from a defined rectangular area within the page layout."""
            x0, y0, x1, y1 = rect
            text_content = []
            elements = []
            for element in page_layout:
                # if isinstance(element, (LTTextBox, LTTextLine)):
                # Check for any overlap between the text element and the rectangle
                ex0, ey0, ex1, ey1 = element.bbox
                if not (ex1 < x0 or ex0 > x1 or ey1 < y0 or ey0 > y1):
                    try:
                        text_content.append(element.get_text())
                    except:
                        pass
            return ''.join(text_content)

        async def addDocumentMetadata(file_id, page_id_to_number, extracted_data, split_pages_dicts, page_dimensions):

            user = os.environ.get("SQL_USER", "")
            password = os.environ.get("SQL_PASSWORD", "")
            database = os.environ.get("SQL_DATABASE", "")
            host = os.environ.get("SQL_SERVER", "")

            conn = await asyncpg.connect(user=user, password=password, database=database, host=host)
            print("PAGE_DIMS", page_dimensions)
            records = await conn.fetch("""
                INSERT INTO fileMetadata (fileid, pagemap, contentlist, pagecontent, pagedimensions) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (fileid)
                DO UPDATE SET
                        pagemap = EXCLUDED.pagemap,
                        contentlist = EXCLUDED.contentlist,
                        pagecontent = EXCLUDED.pagecontent
                        pagedimensions = EXCLUDED.pagedimensions;
            """, file_id,
                json.dumps(page_id_to_number, ensure_ascii=False),
                json.dumps([anotation.to_dict() for anotation in extracted_data], ensure_ascii=False),
                json.dumps(split_pages_dicts, ensure_ascii=False),
                json.dumps(page_dimensions, ensure_ascii=False))

            await conn.close()

        class pdfFeatures:
            def __init__(self, fileid, pageMap, contentList):
                self.fileid = fileid
                self.pageMap = pageMap
                self.contentList = contentList

        class anotationInfo:
            def __init__(self, fileid, srcPageNum, srcText, destPageId, destPageNum):
                self.fileid = fileid
                self.srcPageNum = srcPageNum
                self.srcText = srcText
                self.destPageId = destPageId
                self.destPageNum = destPageNum

            def to_dict(self):
                return {
                    'fileid': self.fileid,
                    'srcPageNum': self.srcPageNum,
                    'srcText': self.srcText,
                    'destPageId': self.destPageId,
                    'destPageNum': self.destPageNum
                }

        def extract_contents(text, page_id_to_number):
            reversed_page_id_to_number = {value: key for key, value in page_id_to_number.items()}
            pattern = re.compile(r'(\d+(\.\d+)*)\.\s+(.+?)\s+(\d+)', re.MULTILINE)
            contents = pattern.findall(text)
            annotations = []  # Step 1: Initialize an empty list
            occurrences_map = {}
            last_matchpagenum = -1
            for match in contents:  # Step 2: Iterate over each match
                try:
                    matchpagenum = match[3].strip()
                    pageid = 0
                    if matchpagenum:
                        pageid = reversed_page_id_to_number[int(matchpagenum)]

                    formatted_str = f"{match[0]} {match[2].strip()}"

                    if formatted_str not in occurrences_map:
                        if int(matchpagenum) >= last_matchpagenum:
                            last_matchpagenum = int(matchpagenum)
                            occurrences_map[formatted_str] = True
                            annotation = anotationInfo(file_Id, 1, formatted_str, pageid, matchpagenum)
                            annotations.append(annotation)  # Step 4: Append to the list

                except Exception:
                    traceback.print_exc()

            return annotations

        with open_filename(pdf_path, "rb") as fp:
            print("FL_OPEN_FILE")
            resource_manager = PDFResourceManager()
            device           = PDFPageAggregator(resource_manager)
            interpreter      = PDFPageInterpreter(resource_manager, device)
            extracted_data   = []
            page_id_to_number= {}
            page_number      = 1
            page_dimensions  = []
            for page in PDFPage.get_pages(fp):
                page_id_to_number[page.pageid] = page_number
                page_number += 1

            pageMap = list(page_id_to_number.items())
            fp.seek(0)
            page_number = 0
            for page in PDFPage.get_pages(fp):
                page_number += 1
                interpreter.process_page(page)
                layout = device.get_result()
                if isinstance(layout, LTPage):
                    page_dimensions.append({
                        "page_number": page_number,
                        "width": layout.width,
                        "height": layout.height
                    })

                if page.annots is not None:
                    for annotation in page.annots:
                        anotResolved = resolve1(annotation)
                        destPDFObjRef = anotResolved.get('Dest')
                        if destPDFObjRef == None:
                            continue
                        destPageid = destPDFObjRef[0].objid

                        anotationText = extract_text_by_rect(
                            layout, anotResolved.get('Rect'))

                        destPageNum = page_id_to_number[destPageid]
                        extracted_data.append(anotationInfo(file_Id, page_number,
                                                            anotationText, destPageid, destPageNum))

            ##logging.info("extracted_data",extracted_data)
            if extracted_data == []:
                try:
                    joined_text = ' '.join(d['text'] for d in split_pages_dicts)
                    extracted_data = extract_contents(joined_text, page_id_to_number)
                except Exception as err:
                    print(f"FILESTRATEGYPY¦ERROR¦{err}")

            await addDocumentMetadata(file_Id, page_id_to_number, extracted_data, split_pages_dicts, page_dimensions)

    async def setup(self, search_info: SearchInfo):
        search_manager = SearchManager(
            search_info, self.search_analyzer_name, self.use_acls, self.embeddings)
        await search_manager.create_index()

    async def run(self, search_info: SearchInfo,):
        print("FILESTRATEGYPY¦List Paths From Filter Strategy")
        search_manager = SearchManager(
            search_info, self.search_analyzer_name, self.use_acls, self.embeddings)

        if self.document_action == DocumentAction.Add:
            files = self.list_file_strategy.list()
            async for file in files:
                try:
                    # Category is FileID [TODO: Rename]
                    print("FFF!", file.path)
                    pages = [page async for page in self.pdf_parser.parse(content=file.content)]
                    if search_info.verbose:
                        print(f"SPLIT '{file.filename()}' INTO SECTIONS")
                    sections = [
                        Section(split_page, content=file, category=self.category,
                                users=self.users, space=self.space)
                        for split_page in self.text_splitter.split_pages(pages)
                    ]


                    await search_manager.update_content(sections)
                    print("FILESTRATEGYPY¦ExtractPDF⇛Path", file.path)

                    try:
                        split_pages = [section.split_page for section in sections]
                        split_pages_dicts = [{'page_num': split_page.page_num, 'text': split_page.text} for split_page in split_pages]
                        # Extract Annotations into DB

                        #await self.extractPDFFeatures(
                        #    file.path, self.category,split_pages_dicts)

                        asyncio.create_task(self.extractPDFFeatures(
                            file.path, self.category, split_pages_dicts))


                    except Exception as err:
                        print(f"FILESTRATEGYPY¦ERROR¦{err}")


                    # @PY ¦ run ⇛ upload_blob ⇒ Blob Subfoldering on Upload
                    await self.blob_manager.upload_blob(file, self.users, self.category)
                finally:
                    if file:
                        file.close()

                        if os.path.exists(file.content.name):
                            os.remove(file.content.name)
                        if os.path.exists(f"{file.content.name}.md5"):
                            os.remove(f"{file.content.name}.md5")

        elif self.document_action == DocumentAction.Remove:
            print("FILESTRATEGYPY¦Remove Action")
            paths = self.list_file_strategy.list_paths()
            async for path in paths:
                pathParse = path.replace("\\", "/").replace("data/", "")
                print(f"FILESTRATEGYPY¦REMOVEBLOB¦Removing {pathParse}")
                await self.blob_manager.remove_blob(pathParse, self.category, self.users)
                await search_manager.remove_content(pathParse, self.category, self.users)
        elif self.document_action == DocumentAction.RemoveAll:

            await self.blob_manager.remove_blob()
            await search_manager.remove_content()
