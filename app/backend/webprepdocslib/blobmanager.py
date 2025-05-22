import os
import re
import logging
from typing import Optional, Union

from azure.core.credentials_async import AsyncTokenCredential
from azure.storage.blob.aio import BlobServiceClient

from .listfilestrategy import File


class BlobManager:
    """
    Class to manage uploading and deleting blobs containing citation information from a blob storage account
    """

    def __init__(
        self,
        endpoint: str,
        container: str,
        credential: Union[AsyncTokenCredential, str],
        verbose: bool = False,
    ):
        self.endpoint = endpoint
        self.credential = credential
        self.container = container
        self.verbose = verbose

    async def upload_blob(self, file: File, virtualSubDir: Optional[str] = None, category: Optional[str] = None):
        async with BlobServiceClient(
            account_url=self.endpoint, credential=self.credential, max_single_put_size=4 * 1024 * 1024
        ) as service_client, service_client.get_container_client(self.container) as container_client:
            if not await container_client.exists():
                await container_client.create_container()

            # Re-open and upload the original file
            with open(file.content.name, "rb") as reopened_file:
                if virtualSubDir is not None:
                    # blob_name = BlobManager.blob_name_from_file_name_subfoldered(file.content.name, virtualSubDir)
                    blob_name = BlobManager.blob_name_from_file_name_subfoldered(f"{category}", virtualSubDir) ## @PY ¦ upload_blob ⇒ Blob Subfoldering on Upload
                else:
                    #blob_name = BlobManager.blob_name_from_file_name(file.content.name)
                    blob_name = BlobManager.blob_name_from_file_name(f"{category}")
                print(f"\tUploading Blob For Whole File ⇒ {blob_name} SRC ⇒ {file.content.name} ¦ CAT ⇒ {category}")

                await container_client.upload_blob(blob_name, reopened_file, overwrite=True)


    async def remove_blob(self, path: Optional[str] = None, category: Optional[str] = None, user: Optional[str] = None ): ## @PY ¦ remove_blob ⇒ Remove Blob by Path
        async with BlobServiceClient(
            account_url=self.endpoint, credential=self.credential
        ) as service_client, service_client.get_container_client(self.container) as container_client:
            print(f"\tREMOVEBLOB¦Path {path} USER {user}")
            ## logging.info("REMBLB¦path ", path) ## Leads to Big Error with the logging
            if not await container_client.exists():
                return
            if path is None:
                prefix = None
                blobs = container_client.list_blob_names()
            else:
                prefix = None
                if(user is not None and user != ""):
                    prefix = f"{user}/{category}"
                    catt = f"{user}/{category}"
                else:
                    catt = f"{category}"

                print("CATTTTTTTTTT",catt)
                blobs = container_client.list_blob_names(name_starts_with=catt)
            async for blob_path in blobs:
                print(f"\tREMOVEBLOB¦Removing {blob_path}")
                await container_client.delete_blob(blob_path)

    @classmethod
    def sourcepage_from_file_page(cls, filename, page=0) -> str:
        if os.path.splitext(filename)[1].lower() == ".pdf":
            return f"{os.path.basename(filename)}#page={page+1}"
        else:
            return os.path.basename(filename)

    @classmethod
    def blob_name_from_file_name(cls, filename) -> str:
        return os.path.basename(filename)

    @classmethod
    def blob_name_from_file_name_subfoldered(cls, filename, subFolder) -> str:
        return os.path.join(subFolder, os.path.basename(filename))
