import argparse
import asyncio
from typing import Any, Optional, Union

from azure.core.credentials import AzureKeyCredential
from azure.core.credentials_async import AsyncTokenCredential
from azure.identity.aio import AzureDeveloperCliCredential

from webprepdocslib.blobmanager import BlobManager
from webprepdocslib.embeddings import (
    AzureOpenAIEmbeddingService,
    OpenAIEmbeddings,
    OpenAIEmbeddingService,
)
from webprepdocslib.filestrategy import DocumentAction, FileStrategy
from webprepdocslib.listfilestrategy import (
    ADLSGen2ListFileStrategy,
    ListFileStrategy,
    LocalListFileStrategy,
)
from webprepdocslib.pdfparser import DocumentAnalysisPdfParser, LocalPdfParser, PdfParser
from webprepdocslib.strategy import SearchInfo, Strategy
from webprepdocslib.textsplitter import TextSplitter
import base64
from fpdf import FPDF
import io

def is_key_empty(key):
    return key is None or len(key.strip()) == 0

def setup_file_strategy(credential: AsyncTokenCredential, args: Any) -> FileStrategy:
    storage_creds = credential if is_key_empty(args.storagekey) else args.storagekey
    blob_manager = BlobManager(
        endpoint=f"https://{args.storageaccount}.blob.core.windows.net",
        container=args.container,
        credential=storage_creds,
        verbose=args.verbose,
    )

    pdf_parser: PdfParser
    if args.localpdfparser:
        pdf_parser = LocalPdfParser()
    else:
        # check if Azure Document Intelligence credentials are provided
        if args.formrecognizerservice is None:
            print(
                "Error: Azure Document Intelligence service is not provided. Please provide --formrecognizerservice or use --localpdfparser for local pypdf parser."
            )
            exit(1)
        formrecognizer_creds: Union[AsyncTokenCredential, AzureKeyCredential] = (
            credential if is_key_empty(args.formrecognizerkey) else AzureKeyCredential(args.formrecognizerkey)
        )
        pdf_parser = DocumentAnalysisPdfParser(
            endpoint=f"https://{args.formrecognizerservice}.cognitiveservices.azure.com/",
            credential=formrecognizer_creds,
            verbose=args.verbose,
        )

    use_vectors = not args.novectors
    embeddings: Optional[OpenAIEmbeddings] = None
    if use_vectors and args.openaihost != "openai":
        azure_open_ai_credential: Union[AsyncTokenCredential, AzureKeyCredential] = (
            credential if is_key_empty(args.openaikey) else AzureKeyCredential(args.openaikey)
        )
        embeddings = AzureOpenAIEmbeddingService(
            open_ai_service=args.openaiservice,
            open_ai_deployment=args.openaideployment,
            open_ai_model_name=args.openaimodelname,
            credential=azure_open_ai_credential,
            disable_batch=args.disablebatchvectors,
            verbose=args.verbose,
        )
    elif use_vectors:
        embeddings = OpenAIEmbeddingService(
            open_ai_model_name=args.openaimodelname,
            credential=args.openaikey,
            organization=args.openaiorg,
            disable_batch=args.disablebatchvectors,
            verbose=args.verbose,
        )

    print("Processing Files")
    list_file_strategy: ListFileStrategy
    if args.datalakestorageaccount:
        adls_gen2_creds = credential if is_key_empty(args.datalakekey) else args.datalakekey
        print(f"Using Data Lake Gen2 Storage Account {args.datalakestorageaccount}")
        list_file_strategy = ADLSGen2ListFileStrategy(
            data_lake_storage_account=args.datalakestorageaccount,
            data_lake_filesystem=args.datalakefilesystem,
            data_lake_path=args.datalakepath,
            credential=adls_gen2_creds,
            verbose=args.verbose,
        )
    else:
        print(f"Using Local Files ⇒ {args.files}")
        list_file_strategy = LocalListFileStrategy(path_pattern=args.files, verbose=args.verbose)

    if args.removeall:
        document_action = DocumentAction.RemoveAll
    elif args.remove:
        print("Removing Files", args.category)
        document_action = DocumentAction.Remove

    else:
        document_action = DocumentAction.Add

    return FileStrategy( ## @PY INIT STARTEGY
        list_file_strategy=list_file_strategy,
        blob_manager=blob_manager,
        pdf_parser=pdf_parser,
        text_splitter=TextSplitter(),
        document_action=document_action,
        embeddings=embeddings,
        search_analyzer_name=args.searchanalyzername,
        use_acls=args.useacls,
        category=args.category,
        users=args.users,
        space=args.space,
    )

async def base64_to_pdf(base64_string, filename):
    # Decode the base64 string
    pdf_bytes = base64.b64decode(base64_string)

    # Create a PDF object and add a page
    pdf = FPDF()
    pdf.add_page()

    # Move the file pointer to the beginning of the byte stream
    pdf_file = io.BytesIO(pdf_bytes)
    pdf_file.seek(0)

    # Save the PDF to a file
    with open(filename, "wb") as file:
        file.write(pdf_file.read())

class Args:
    def __init__(self, dictionary):
        for key in dictionary:
            setattr(self, key, dictionary[key])

async def runStrat(strategy: Strategy, credential: AsyncTokenCredential, args: Any):
    search_creds: Union[AsyncTokenCredential, AzureKeyCredential] = (
        credential if is_key_empty(args.searchkey) else AzureKeyCredential(args.searchkey)
    )
    print(f"[DEBUG] runStrat: args.searchkey={repr(args.searchkey)}")
    print(f"[DEBUG] runStrat: Using search_creds type: {type(search_creds).__name__}")
    search_info = SearchInfo(
        endpoint=f"https://{args.searchservice}.search.windows.net/",
        credential=search_creds,
        index_name=args.index,
        verbose=args.verbose,
    )
    if not args.remove and not args.removeall:
        await strategy.setup(search_info)

    file_strategy = setup_file_strategy(credential, args)
    await main(file_strategy, credential, args) ## @PY ¦ runStrat ⇒ main

async def main(strategy: Strategy, credential: AsyncTokenCredential, args: Any):
    search_creds: Union[AsyncTokenCredential, AzureKeyCredential] = (
        credential if is_key_empty(args.searchkey) else AzureKeyCredential(args.searchkey)
    )
    search_info = SearchInfo(
        endpoint=f"https://{args.searchservice}.search.windows.net/",
        credential=search_creds,
        index_name=args.index,
        verbose=args.verbose,
    )

    if not args.remove and not args.removeall:
        await strategy.setup(search_info)

    await strategy.run(search_info) ## @PY ¦ STRAT main ⇒ run