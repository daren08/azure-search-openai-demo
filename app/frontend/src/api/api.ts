const BACKEND_URI = "";

import { ChatAppResponse, ChatAppResponseOrError, ChatAppRequest, Config, SimpleAPIResponse } from "./models";
import { useLogin, appServicesToken } from "../authConfig";

export function getHeaders(idToken: string | undefined): Record<string, string> {
    // If using login and not using app services, add the id token of the logged in account as the authorization
    if (useLogin && appServicesToken == null) {
        if (idToken) {
            return { Authorization: `Bearer ${idToken}` };
        }
    }

    return {};
}

export async function configApi(): Promise<Config> {
    const response = await fetch(`${BACKEND_URI}/config`, {
        method: "GET"
    });

    return (await response.json()) as Config;
}

export async function askApi(request: ChatAppRequest, idToken: string | undefined): Promise<ChatAppResponse> {
    const response = await fetch(`${BACKEND_URI}/ask`, {
        method: "POST",
        headers: { ...getHeaders(idToken), "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    const parsedResponse: ChatAppResponseOrError = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse as ChatAppResponse;
}

export async function chatApi(request: ChatAppRequest, shouldStream: boolean, idToken: string | undefined): Promise<Response> {
    let url = `${BACKEND_URI}/chat`;
    if (shouldStream) {
        url += "/stream";
    }
    return await fetch(url, {
        method: "POST",
        headers: { ...getHeaders(idToken), "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });
}

export async function getSpeechApi(text: string): Promise<string | null> {
    return await fetch("/speech", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: text
        })
    })
        .then(response => {
            if (response.status == 200) {
                return response.blob();
            } else if (response.status == 400) {
                console.log("Speech synthesis is not enabled.");
                return null;
            } else {
                console.error("Unable to get speech synthesis.");
                return null;
            }
        })
        .then(blob => (blob ? URL.createObjectURL(blob) : null));
}

export function getCitationFilePath(citation: string): string {
    return `${BACKEND_URI}/content/${citation}`;
}

export async function uploadFileApi(request: FormData, idToken: string): Promise<SimpleAPIResponse> {
    const response = await fetch("/upload", {
        method: "POST",
        headers: getHeaders(idToken),
        body: request
    });

    if (!response.ok) {
        throw new Error(`Uploading files failed: ${response.statusText}`);
    }

    const dataResponse: SimpleAPIResponse = await response.json();
    return dataResponse;
}

export async function deleteUploadedFileApi(filename: string, idToken: string): Promise<SimpleAPIResponse> {
    const response = await fetch("/delete_uploaded", {
        method: "POST",
        headers: { ...getHeaders(idToken), "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
    });

    if (!response.ok) {
        throw new Error(`Deleting file failed: ${response.statusText}`);
    }

    const dataResponse: SimpleAPIResponse = await response.json();
    return dataResponse;
}

export async function listUploadedFilesApi(idToken: string): Promise<string[]> {
    const response = await fetch(`/list_uploaded`, {
        method: "GET",
        headers: getHeaders(idToken)
    });

    if (!response.ok) {
        throw new Error(`Listing files failed: ${response.statusText}`);
    }

    const dataResponse: string[] = await response.json();
    return dataResponse;
}


export async function chunkUploadApi(
    formData: FormData,
    idToken: string
): Promise<{ message: string }> {
    const response = await fetch(`/chunk_upload`, {
        method: "POST",
        headers: getHeaders(idToken),
        body: formData
    });
    if (!response.ok) {
        throw new Error(`Chunk upload failed: ${response.statusText}`);
    }
    return await response.json();
}

export interface ContainerFileInfo {
    name: string;
    size: number;
    last_modified: string;
}

export async function listContainerFilesApi(idToken: string): Promise<ContainerFileInfo[]> {
    const response = await fetch(`/list_container_files`, {
        method: "GET",
        headers: getHeaders(idToken)
    });
    if (!response.ok) {
        throw new Error(`Listing files failed: ${response.statusText}`);
    }
    return await response.json();
}

export async function deleteContainerFileApi(filename: string, idToken: string, userId: string): Promise<SimpleAPIResponse> {
    // Delete from blob storage
    const response = await fetch("/delete_container_file", {
        method: "POST",
        headers: { ...getHeaders(idToken), "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
    });
    if (!response.ok) {
        throw new Error(`Deleting file failed: ${response.statusText}`);
    }
    const result = await response.json();

    // Call reindex_after_delete to update search index
    try {
        await fetch("/reindex_after_delete", {
            method: "POST",
            headers: { ...getHeaders(idToken), "Content-Type": "application/json" },
            body: JSON.stringify({ filename, userId })
        });
    } catch (e) {
        // Optionally handle error, but don't block UI
        console.error("Failed to call reindex_after_delete", e);
    }
    return result;
}

export async function reindexContainerFileApi(filename: string, idToken: string, userId: string): Promise<{ message: string }> {
    const response = await fetch("/reindex_container_file", {
        method: "POST",
        headers: { ...getHeaders(idToken), "Content-Type": "application/json" },
        body: JSON.stringify({ filename, userid: userId })
    });
    if (!response.ok) {
        throw new Error(`Reindexing file failed: ${response.statusText}`);
    }
    return await response.json();
}

export async function downloadContainerFileApi(filename: string, idToken: string): Promise<void> {
    const response = await fetch(`/download_container_file?filename=${encodeURIComponent(filename)}`, {
        method: "GET",
        headers: getHeaders(idToken)
    });
    if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
    }
    // Get filename from Content-Disposition header if available
    const disposition = response.headers.get("Content-Disposition");
    let downloadName = filename;
    if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match) downloadName = match[1];
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}