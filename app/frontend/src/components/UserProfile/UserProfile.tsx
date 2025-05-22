import React, { useState, useContext, useEffect } from "react";
import { Avatar, Popover, Button } from "@mui/material";
import { IconButton, Tooltip, Typography, Divider, Box, Link as MULink } from "@mui/material";
import { Close, Settings as SettingsIcon } from "@mui/icons-material";
import { Person24Regular } from "@fluentui/react-icons";
import ChunkUpload from "../ChunkUpload/ChunkUpload";
import styles from "./UserProfile.module.css"; // Optional: adjust based on your project

export interface UserProfileProps {
    isLoggedIn: boolean;
    userName: string;
    userEmail: string;
    userInitials: string;
    profilePicture: string | null;
    onLogin: () => Promise<void>;
    onLogout: () => Promise<void>;
}

export const UserProfile = ({ isLoggedIn, onLogin, onLogout }: UserProfileProps) => {

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? "user-popover" : undefined;

    const [userProfile, setUserProfile] = useState<any>({});
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [userInitials, setUserInitials] = useState("U");
    const [userName, setUserName] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [showChunkUpload, setShowChunkUpload] = useState(false);

    const fetchUserProfile = () => {
        const storedProfile = JSON.parse(localStorage.getItem("whiddon-userProfile") || "{}");
        const storedPicture = localStorage.getItem("whiddon-userProfilePicture");

        setUserProfile(storedProfile);
        setProfilePicture(storedPicture);
        setUserInitials(storedProfile.initials || storedProfile.name?.charAt(0) || "U");
        setUserName(storedProfile.name || "");
        setUserEmail(storedProfile.email || "");
    };

    useEffect(() => {
        if (isLoggedIn) {
            fetchUserProfile();
        }
    }, [isLoggedIn]); // run effect again when login state changes

    useEffect(() => {
        const handleUserProfileUpdate = () => {
            console.log("Handling userProfileUpdated event");
            fetchUserProfile();
        };
        window.addEventListener("whiddon-userProfileUpdated", handleUserProfileUpdate);

        return () => {
            window.removeEventListener("whiddon-userProfileUpdated", handleUserProfileUpdate);
        };
    }, []);

    const handleShowChunkUpload = () => {
        setShowChunkUpload(true);

        handleClose();
    };

    return (
        <div className={styles.logoutContainer}>
            {isLoggedIn ? (
                <>
                    <Avatar
                        src={profilePicture || undefined}
                        sx={{
                            width: 45,
                            height: 45,
                            cursor: "pointer",
                            marginRight: "20px",
                            bgcolor: profilePicture ? "transparent" : "#0078D4"
                        }}
                        onClick={handleClick}
                    >
                        {!profilePicture && userInitials}
                    </Avatar>
                </>
            ) : (
                <Tooltip title="Log In" arrow>
                    <IconButton onClick={onLogin} aria-label="Log in" sx={{ color: "white", marginRight: "20px" }}>
                        <Person24Regular />
                    </IconButton>
                </Tooltip>
            )}

            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right"
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right"
                }}
                sx={{ marginTop: 1 }}
            >
                <Box sx={{ width: 350, p: 2, display: "flex", flexDirection: "column" }}>
                    <IconButton sx={{ position: "absolute", right: 8, top: 8 }} onClick={handleClose} size="small">
                        <Close />
                    </IconButton>

                    <Typography variant="subtitle1" fontWeight="bold">
                        Profile
                    </Typography>
                    <Divider className="mt-2" />

                    <Box sx={{ mt: 3, display: "flex" }}>
                        <Avatar
                            src={profilePicture || undefined}
                            sx={{
                                width: 80,
                                height: 80,
                                mx: "10px",
                                bgcolor: profilePicture ? "transparent" : "#0078D4"
                            }}
                        >
                            {!profilePicture && userInitials}
                        </Avatar>

                        <Box>
                            {/* <Typography
                                variant="caption"
                                sx={{
                                    bgcolor: "#019ba7",
                                    color: "white",
                                    borderRadius: "12px",
                                    px: 2,
                                    py: 0.5,
                                    mt: 1,
                                    display: "inline-block"
                                }}
                            >
                                Workspace Owner
                            </Typography> */}
                            <Typography variant="caption" sx={{ fontWeight: "bold", mt: 1, display: "block" }}>
                                {userName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                                {userEmail}
                            </Typography>
                            <MULink href="https://myaccount.microsoft.com/" underline="none">
                                <Typography variant="caption" sx={{ color: "primary.main", cursor: "pointer", mt: 1, display: "block" }}>
                                    View Profile
                                </Typography>
                            </MULink>

                            {/* Show Settings text if role is Admin */}
                            {userProfile.role.toLower() === "admin" && (
                                <Tooltip title="Settings">
                                    <span style={{ display: "flex", alignItems: "center", cursor: "pointer" }} onClick={handleShowChunkUpload}>
                                        <SettingsIcon sx={{ fontSize: 18, color: "#757575", mr: 0.5 }} />
                                        <Typography variant="caption" sx={{ color: "#757575", fontWeight: 500, userSelect: "none", mt: 0.5 }}>
                                            Settings
                                        </Typography>
                                    </span>
                                </Tooltip>
                            )}
                        </Box>
                    </Box>

                    <Button
                        fullWidth
                        variant="outlined"
                        sx={{ mt: 2, borderColor: "orange", color: "orange" }}
                        onClick={() => {
                            handleClose();
                            onLogout();
                        }}
                    >
                        Sign Out
                    </Button>
                </Box>
            </Popover>
            {/* Show ChunkUpload modal/dialog if showChunkUpload is true */}
            {showChunkUpload && (
                <div style={{ position: "fixed", top: 100, left: 600, zIndex: 1300 }}>
                    <ChunkUpload onClose={() => setShowChunkUpload(false)} />
                </div>
            )}
        </div>
    );
};
