import os
import asyncpg
import json

from pdfminer.converter import PDFPageAggregator
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfpage import PDFPage
from pdfminer.utils import open_filename
from pdfminer.pdftypes import resolve1
from pdfminer.layout import LAParams, LTTextBox, LTTextLine, LTChar


def extract_text_by_rect(page_layout, rect):
    """Extracts text from a defined rectangular area within the page layout."""
    x0, y0, x1, y1 = rect
    text_content = []
    for element in page_layout:
        # if isinstance(element, (LTTextBox, LTTextLine)):
        # Check for any overlap between the text element and the rectangle
        ex0, ey0, ex1, ey1 = element.bbox
        if not (ex1 < x0 or ex0 > x1 or ey1 < y0 or ey0 > y1):

            # print(element.bbox)

            try:
                text_content.append(element.get_text())
            except:
                pass
    return ''.join(text_content)


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


def extractPDFFeatures(pdf_path, file_Id):

    with open_filename(pdf_path, "rb") as fp:
        resource_manager = PDFResourceManager()
        device = PDFPageAggregator(resource_manager)
        interpreter = PDFPageInterpreter(resource_manager, device)

        # Content List
        extracted_data = []

        # Dictionary to map internal page IDs to actual page numbers
        page_id_to_number = {}

        # First pass to populate the page ID to page number mapping
        page_number = 1
        for page in PDFPage.get_pages(fp):
            page_id_to_number[page.pageid] = page_number
            page_number += 1

        pageMap = list(page_id_to_number.items())

        # Reset file pointer to start for the second pass
        fp.seek(0)
        page_number = 0
        for page in PDFPage.get_pages(fp):
            page_number += 1
            interpreter.process_page(page)
            layout = device.get_result()
            # print(layout)
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

        ##addDocumentMetadata(file_Id, page_id_to_number, extracted_data)


async def addDocumentMetadata(file_id, page_id_to_number, extracted_data):

    user = os.environ.get("SQL_USER", "")
    password = os.environ.get("SQL_PASSWORD", "")
    database = os.environ.get("SQL_DATABASE", "")
    host = os.environ.get("SQL_SERVER", "")

    conn = await asyncpg.connect(user=user, password=password, database=database, host=host)


    print("!JSON_extracted_data",json.dumps(extracted_data))
    print("!extracted_data", extracted_data)

    records = await conn.fetch("""
        INSERT INTO fileMetadata (fileid, pagemap, contentlist) VALUES ($1, $2, $3)
        ON CONFLICT (fileid)
        DO UPDATE SET
                pagemap = EXCLUDED.pagemap,
                contentlist = EXCLUDED.contentlist;
    """, file_id, json.dumps(page_id_to_number), json.dumps(extracted_data))
    await conn.close()
