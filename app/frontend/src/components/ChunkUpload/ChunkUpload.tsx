import React, { useState, useRef } from "react";
import { chunkUploadApi, listContainerFilesApi, deleteContainerFileApi, reindexContainerFileApi, downloadContainerFileApi } from "../../api/api";
import {
    Box,
    Button,
    LinearProgress,
    Typography,
    Alert,
    Stack,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    IconButton,
    TextField,
    Snackbar,
    Tooltip
} from "@mui/material";
import Grid from "@mui/material/Grid";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CircularProgress from '@mui/material/CircularProgress';
import SyncIcon from '@mui/icons-material/Sync';
import DownloadIcon from '@mui/icons-material/Download';

const CHUNK_SIZE = 100 * 1024; // 100KB per chunk for better progress feedback

interface ChunkUploadProps {
    onClose?: () => void;
}

const ChunkUpload: React.FC<ChunkUploadProps> = ({ onClose }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number; last_modified: string }[]>([]);
    const [message, setMessage] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [searchText, setSearchText] = useState<string>("");
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>("success");
    const [deletingFile, setDeletingFile] = useState<string | null>(null);
    const [reindexingFile, setReindexingFile] = useState<string | null>(null);
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null); // NEW
    const inputRef = useRef<HTMLInputElement>(null);

    // Replace with your auth token logic
    const idToken = undefined;

    // Simulate getting userId from auth context or props
    const userProfile = JSON.parse(localStorage.getItem("whiddon-userProfile") || "{}");
    const userId = userProfile.userId;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
            setError("");
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);
        setProgress(0);
        setMessage("");
        setError("");
        const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(selectedFile.size, start + CHUNK_SIZE);
            const chunk = selectedFile.slice(start, end);
            const formData = new FormData();
            formData.append("filename", selectedFile.name);
            formData.append("chunkIndex", i.toString());
            formData.append("totalChunks", totalChunks.toString());
            formData.append("chunk", chunk);
            try {
                // Set progress BEFORE uploading chunk for immediate feedback
                setProgress(Math.round(((i + 1) / totalChunks) * 100));
                console.log(`Uploading chunk ${i + 1} of ${totalChunks} (${Math.round(((i + 1) / totalChunks) * 100)}%)`);
                await new Promise(resolve => setTimeout(resolve, 0)); // Force UI update
                const res = await chunkUploadApi(formData, idToken as any);
                setMessage(res.message);
            } catch (err: any) {
                setError(err.message || "Upload failed");
                setSnackbarMessage(err.message || "Upload failed");
                setSnackbarSeverity("error");
                setSnackbarOpen(true);
                setUploading(false);
                return;
            }
        }
        setUploading(false);
        setSelectedFile(null);
        if (inputRef.current) inputRef.current.value = "";
        setSnackbarMessage("File uploaded successfully");
        setSnackbarSeverity("success");
        setSnackbarOpen(true);
        await fetchFiles();
    };

    const fetchFiles = async () => {
        console.log("fetch files called.");
        setIsLoadingFiles(true);
        try {
            const files = await listContainerFilesApi(idToken as any);
            setUploadedFiles(files);
        } catch (err) {
            setUploadedFiles([]);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    const handleDelete = async (fileName: string) => {
        setDeletingFile(fileName);
        try {
            await deleteContainerFileApi(fileName, idToken as any, userId); // Pass userId
            setMessage(`Deleted ${fileName}`);
            setSnackbarMessage(`Deleted ${fileName}`);
            setSnackbarSeverity("success");
            setSnackbarOpen(true);
            await fetchFiles();
        } catch (err: any) {
            setError(err.message || "Delete failed");
            setSnackbarMessage(err.message || "Delete failed");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
        } finally {
            setDeletingFile(null);
        }
    };

    React.useEffect(() => {
        fetchFiles();
    }, []);

    const filteredFiles = uploadedFiles.filter(file =>
        file.name.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <Box sx={{ p: { xs: 1, sm: 2, md: 4 }, maxWidth: { xs: '100vw', sm: 700 }, width: '100%', margin: 'auto', height: { xs: 'auto', sm: 600 }, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'background.paper', borderRadius: 2, boxShadow: 3 }}>
            <Button
                onClick={onClose}
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    minWidth: 0,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'transparent',
                    color: 'grey.700',
                    fontSize: 24,
                    zIndex: 1,
                    '&:hover': { background: 'rgba(0,0,0,0.04)' }
                }}
                aria-label="Close"
            >
                ×
            </Button>
            <Stack spacing={2} sx={{ height: '100%' }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'flex-start', mb: 1, gap: 0 }}>
                    <TextField
                        size="small"
                        variant="outlined"
                        placeholder="Search files..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        sx={{ minWidth: { xs: 120, sm: 125 }, flex: 0.5 }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton
                            color="primary"
                            component="span"
                            onClick={() => {
                                if (!selectedFile && !uploading) {
                                    inputRef.current?.click();
                                } else if (selectedFile && !uploading) {
                                    handleUpload();
                                }
                            }}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <Box sx={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <LinearProgress variant="determinate" value={progress} sx={{ width: 32, height: 32, borderRadius: '50%' }} />
                                </Box>
                            ) : selectedFile ? (
                                <Tooltip title="Upload">
                                    <CloudUploadIcon sx={{ color: "#673AB7" }} />
                                </Tooltip>
                            ) : (
                                <Tooltip title="Select File">
                                    <UploadFileIcon />
                                </Tooltip>
                            )}
                        </IconButton>
                        <input
                            type="file"
                            ref={inputRef}
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            disabled={uploading}
                        />
                        {/* Show file name and progress beside the upload button */}
                        {selectedFile && !uploading && (
                            <Typography variant="body2" color="primary" sx={{ ml: 2, wordBreak: 'break-all', maxWidth: 200 }}>
                                Selected: {selectedFile.name}
                            </Typography>
                        )}
                        {uploading && selectedFile && (
                            <Box sx={{ ml: 2, minWidth: 200 }}>
                                <Typography variant="body2" gutterBottom color="warning">
                                    Uploading: {selectedFile.name} ({progress}%)
                                </Typography>
                                <LinearProgress variant="determinate" value={progress} />
                            </Box>
                        )}
                        {!selectedFile && !uploading && (
                            <Typography variant="caption" color="primary">
                                Select File to Upload
                            </Typography>
                        )}
                    </Box>
                </Box>
                {uploading && (
                    <Box>
                        <Typography variant="body2" gutterBottom color="warning">
                            Uploading: {progress}%
                        </Typography>
                        <LinearProgress variant="determinate" value={progress} />
                    </Box>
                )}
                {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}
                {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <TableContainer sx={{ flex: 1, overflowY: 'auto', minHeight: 0, maxHeight: { xs: 300, sm: 400, md: 500 } }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ minWidth: 120 }}>Name</TableCell>
                                    <TableCell sx={{ minWidth: 90 }}>Size</TableCell>
                                    <TableCell sx={{ minWidth: 140 }}>Modified</TableCell>
                                    <TableCell align="center" sx={{ minWidth: 80 }}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {isLoadingFiles ? (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center">
                                            <LinearProgress style={{ width: '100%' }} />
                                            <Typography variant="body2" sx={{ mt: 1 }}>Loading files...</Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredFiles.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center">
                                            No files uploaded yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredFiles.map((file) => {
                                        const sizeKB = file.size / 1024;
                                        const sizeDisplay = sizeKB > 1000
                                            ? `${(sizeKB / 1024).toFixed(2)} MB`
                                            : `${sizeKB.toFixed(2)} KB`;
                                        return (
                                            <TableRow key={file.name} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}>
                                                <TableCell sx={{ wordBreak: 'break-all', maxWidth: { xs: 120, sm: 200 } }}>{file.name}</TableCell>
                                                <TableCell>{sizeDisplay}</TableCell>
                                                <TableCell>{file.last_modified ? new Date(file.last_modified).toLocaleString() : ''}</TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Download" arrow>
                                                        <span>
                                                            <IconButton
                                                                sx={{ color: '#019BA7' }}
                                                                aria-label="download"
                                                                size="small"
                                                                onClick={async () => {
                                                                    setDownloadingFile(file.name);
                                                                    try {
                                                                        await downloadContainerFileApi(file.name, idToken as any);
                                                                    } catch (err: any) {
                                                                        setSnackbarMessage(err.message || "Download failed");
                                                                        setSnackbarSeverity("error");
                                                                        setSnackbarOpen(true);
                                                                    } finally {
                                                                        setDownloadingFile(null);
                                                                    }
                                                                }}
                                                                disabled={uploading || deletingFile === file.name || reindexingFile === file.name || downloadingFile === file.name}
                                                            >
                                                                {downloadingFile === file.name ? <CircularProgress size={20} /> : <DownloadIcon fontSize="small" />}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Tooltip title="Reindex" arrow>
                                                        <span>
                                                            <IconButton
                                                                color="primary"
                                                                aria-label="reindex"
                                                                size="small"
                                                                onClick={async () => {
                                                                    setReindexingFile(file.name);
                                                                    try {
                                                                        setSnackbarMessage("Reindexing...");
                                                                        setSnackbarSeverity("success");
                                                                        setSnackbarOpen(true);
                                                                        await reindexContainerFileApi(file.name, idToken as any, userId);
                                                                        setSnackbarMessage(`Reindex started for ${file.name}`);
                                                                        setSnackbarSeverity("success");
                                                                        setSnackbarOpen(true);
                                                                    } catch (err: any) {
                                                                        setSnackbarMessage(err.message || "Reindex failed");
                                                                        setSnackbarSeverity("error");
                                                                        setSnackbarOpen(true);
                                                                    } finally {
                                                                        setReindexingFile(null);
                                                                    }
                                                                }}
                                                                style={{ marginLeft: 8 }}
                                                                disabled={reindexingFile === file.name}
                                                            >
                                                                {reindexingFile === file.name ? <CircularProgress size={20} /> : <SyncIcon fontSize="small" />}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Tooltip title="Delete" arrow>
                                                        <IconButton
                                                            color="error"
                                                            aria-label="delete"
                                                            size="small"
                                                            onClick={() => handleDelete(file.name)}
                                                            disabled={deletingFile === file.name}>
                                                            {deletingFile === file.name ? <CircularProgress size={20} /> : <DeleteIcon />}
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </Stack>
            {/* <Snackbar
                open={snackbarOpen}
                autoHideDuration={4000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar> */}
        </Box>
    );
};

export default ChunkUpload;
