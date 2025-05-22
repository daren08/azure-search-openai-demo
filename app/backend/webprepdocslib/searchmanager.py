import asyncio
import os
import asyncpg

from typing import List, Optional

from azure.search.documents.indexes.models import (
    HnswAlgorithmConfiguration,
    HnswParameters,
    SearchableField,
    SearchField,
    SearchFieldDataType,
    SearchIndex,
    SemanticConfiguration,
    SemanticField,
    SemanticPrioritizedFields,
    SemanticSearch,
    SimpleField,
    VectorSearch,
    VectorSearchProfile,
    VectorSearchVectorizer,
    VectorSearchAlgorithmKind
)

from .blobmanager import BlobManager
from .embeddings import OpenAIEmbeddings
from .listfilestrategy import File
from .strategy import SearchInfo
from .textsplitter import SplitPage

user     = os.environ.get("SQL_USER", "")
password = os.environ.get("SQL_PASSWORD", "")
database = os.environ.get("SQL_DATABASE", "")
host     = os.environ.get("SQL_SERVER", "")
bloburl  = os.environ.get("AZURE_STORAGE_ROOT_URL", "")

class Section:
    """
    A section of a page that is stored in a search service. These sections are used as context by Azure OpenAI service
    """

    def __init__(self, split_page: SplitPage, content: File, category: Optional[str] = None, users: Optional[str] = None, space: Optional[str] = None   ):
        self.split_page = split_page
        self.content = content
        self.category = category
        self.users = users
        self.space = space


class SearchManager:
    """
    Class to manage a search service. It can create indexes, and update or remove sections stored in these indexes
    To learn more, please visit https://learn.microsoft.com/azure/search/search-what-is-azure-search
    """

    def __init__(
        self,
        search_info: SearchInfo,
        search_analyzer_name: Optional[str] = None,
        use_acls: bool = False,
        embeddings: Optional[OpenAIEmbeddings] = None,
    ):
        self.search_info = search_info
        self.search_analyzer_name = search_analyzer_name
        self.use_acls = use_acls
        self.embeddings = embeddings

    async def create_index(self):
        if self.search_info.verbose:
            print(f"Ensuring search index {self.search_info.index_name} exists")

        async with self.search_info.create_search_index_client() as search_index_client:
            fields = [
                SimpleField(name="id", type="Edm.String", key=True),
                SearchableField(name="content", type="Edm.String", analyzer_name=self.search_analyzer_name),
                SearchField(
                    name="embedding",
                    type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                    hidden=False,
                    searchable=True,
                    filterable=False,
                    sortable=False,
                    facetable=False,
                    vector_search_dimensions=1536,
                    vector_search_profile_name="embedding_config",
                ),
                SimpleField(name="category", type="Edm.String", filterable=True, facetable=True),
                SimpleField(name="sourcepage", type="Edm.String", filterable=True, facetable=True),
                SimpleField(name="sourcefile", type="Edm.String", filterable=True, facetable=True),
            ]
            if self.use_acls:
                fields.append(
                    SimpleField(
                        name="oids", type=SearchFieldDataType.Collection(SearchFieldDataType.String), filterable=True
                    )
                )
                fields.append(
                    SimpleField(
                        name="groups", type=SearchFieldDataType.Collection(SearchFieldDataType.String), filterable=True
                    )
                )

            index = SearchIndex(
                name=self.search_info.index_name,
                fields=fields,
                semantic_search=SemanticSearch(
                    configurations=[
                        SemanticConfiguration(
                            name="default",
                            prioritized_fields=SemanticPrioritizedFields(
                                title_field=None, content_fields=[SemanticField(field_name="content")]
                            ),
                        )
                    ]
                ),
                vector_search=VectorSearch(
                    algorithms=[
                        HnswAlgorithmConfiguration(
                            name="hnsw_config",
                            kind=VectorSearchAlgorithmKind.HNSW,
                            parameters=HnswParameters(metric="cosine"),
                        )
                    ],
                    profiles=[
                        VectorSearchProfile(
                            name="embedding_config",
                            algorithm_configuration_name="hnsw_config",
                        ),
                    ],
                ),
            )
            if self.search_info.index_name not in [name async for name in search_index_client.list_index_names()]:
                if self.search_info.verbose:
                    print(f"Creating {self.search_info.index_name} search index")
                await search_index_client.create_index(index)
            else:
                if self.search_info.verbose:
                    print(f"Search index {self.search_info.index_name} already exists")

    async def addIndexLog(self, sourcefile, category, id, sourcepage):
        conn = await asyncpg.connect(user=user, password=password, database=database, host=host)
        result = await conn.execute("""
            INSERT INTO fileindexes (indexid, fileid, created, updated, filename, filepage) VALUES ($1::text, $2::text, NOW(), NOW(), $3::text, $4::text)
            ON CONFLICT (indexid) DO
            UPDATE SET
                fileid = EXCLUDED.fileid,
                updated = EXCLUDED.updated,
                filename = EXCLUDED.filename,
                filepage = EXCLUDED.filepage;
            ;""",id, category, sourcefile, sourcepage)
        await conn.close()
    async def removeIndexLog(self, id): ## @PY ¦ Q ⇒ Remove Index Log
        conn = await asyncpg.connect(user=user, password=password, database=database, host=host)
        result = await conn.execute("""
            DELETE FROM fileindexes WHERE indexid = $1::text
            ;""",id)
        await conn.close()
    async def update_content(self, sections: List[Section]):
        MAX_BATCH_SIZE = 1000
        section_batches = [sections[i : i + MAX_BATCH_SIZE] for i in range(0, len(sections), MAX_BATCH_SIZE)]

        async with self.search_info.create_search_client() as search_client:
            for batch_index, batch in enumerate(section_batches):
                documents = [
                    {
                        ## "id": f"{section.Users.split(';')[0]}_{section.content.filename_to_id()}-page-{section_index + batch_index * MAX_BATCH_SIZE}",
                        ##"id": f"{str(section.category)}-page-{section_index + batch_index * MAX_BATCH_SIZE}",
                        "id": f"{section.content.filename_to_id()}-page-{section_index + batch_index * MAX_BATCH_SIZE}",
                        "content": section.split_page.text,
                        "category": str(section.category),
                        "sourcepage": BlobManager.sourcepage_from_file_page(
                            filename=section.content.filename(), page=section.split_page.page_num
                        ), ##  + "#fid=" + str(section.category),
                        "sourcefile": section.content.filename(),
                        "Users": section.space.split(';'),
                        **section.content.acls,
                    }
                    for section_index, section in enumerate(batch)
                ]
                #for sec in documents:
                #    await self.addIndexLog(sec["sourcefile"], str(sec["category"]), sec["id"], sec["sourcepage"])

                if self.embeddings:
                    embeddings = await self.embeddings.create_embeddings(
                        texts=[section.split_page.text for section in batch]
                    )
                    for i, document in enumerate(documents):
                        document["embedding"] = embeddings[i]
                await search_client.upload_documents(documents) ## https://learn.microsoft.com/en-us/python/api/azure-search-documents/azure.search.documents.searchclient?view=azure-python#azure-search-documents-searchclient-upload-documents
    async def remove_content(self, path: Optional[str] = None, category: Optional[str] = None, users: Optional[str] = None, ):
        print("!!remove_content!!","users", users,"category", category,"path", path)
        if not (category or path) or not users:
            raise ValueError("Refusing to remove content from index: both category/path and users must be provided to avoid deleting all data.")
        if self.search_info.verbose:
            print(f"REMOVING SECTIONS '{path or '<all>'}' FROM SRCH INDX '{self.search_info.index_name}'")
        async with self.search_info.create_search_client() as search_client:
            while True:
                catFilter = None if path is None else f"category eq '{category}'"  # Category is FileId in Postgres
                usrFilter = None
                if users is not None and users != "":
                    uFil = "u eq '{}'".format(users)
                    usrFilter = " Users/any(u: " + uFil + ")" if len(users) > 0 else " not Users/any()"

                if catFilter is not None and usrFilter is not None:
                    filter = f"{catFilter} and {usrFilter}"
                elif catFilter is not None:
                    filter = catFilter
                elif usrFilter is not None:
                    filter = usrFilter
                else:
                    filter = None

                print("SRCHMNGR¦REMOVING¦catFilter",catFilter)
                print("SRCHMNGR¦REMOVING¦usrFilter",usrFilter)
                print("SRCHMNGR¦REMOVING¦filter",filter)

                result = await search_client.search("", filter=filter, top=1000, include_total_count=True) if filter else await search_client.search("", top=1000, include_total_count=True)
                if await result.get_count() == 0:
                    print("NOREMOVESRCH RESULTS")
                    break
                documents_to_delete = []
                async for document in result:
                    documents_to_delete.append({"id": document["id"]})
                    #await self.removeIndexLog(document["id"])
                    print("SRCHMNGR¦REMOVING ID¦",document["id"])
                removed_docs = await search_client.delete_documents(documents=documents_to_delete)

                if self.search_info.verbose:
                    print(f"\tRemoved {len(removed_docs)} sections from index")
                # It can take a few seconds for search results to reflect changes, so wait a bit
                await asyncio.sleep(2)
    async def remove_content_v2(self, path: Optional[str] = None, category: Optional[str] = None, users: Optional[str] = None):
        """
        Remove content from index by filtering on sourcefile (filename).
        """
        print("!!remove_content_v2!!", "users", users, "category", category, "path", path)
        if not (category or path):
            raise ValueError("Refusing to remove content from index: category/path must be provided to avoid deleting all data.")
        if self.search_info.verbose:
            print(f"REMOVING SECTIONS (v2) '{path or '<all>'}' FROM SRCH INDX '{self.search_info.index_name}'")
        async with self.search_info.create_search_client() as search_client:
            while True:
                # Use sourcefile for filename-based deletion
                sourcefile_filter = f"sourcefile eq '{category}'" if category else None
                filter = sourcefile_filter

                print("SRCHMNGR¦REMOVING¦sourcefile_filter", sourcefile_filter)
                print("SRCHMNGR¦REMOVING¦filter", filter)

                try:
                    result = await search_client.search("", filter=filter, top=1000, include_total_count=True) if filter else await search_client.search("", top=1000, include_total_count=True)
                except Exception as e:
                    print(f"Azure Search error: {e}. Filter used: {filter}")
                    raise
                if await result.get_count() == 0:
                    print("NOREMOVESRCH RESULTS")
                    break
                documents_to_delete = []
                async for document in result:
                    documents_to_delete.append({"id": document["id"]})
                    print("SRCHMNGR¦REMOVING ID¦", document["id"])
                removed_docs = await search_client.delete_documents(documents=documents_to_delete)

                if self.search_info.verbose:
                    print(f"\tRemoved {len(removed_docs)} sections from index (v2)")
                await asyncio.sleep(2)
