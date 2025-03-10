import { Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { EventType } from "@azure/msal-browser";
import styles from "./Layout.module.css";
import { SplashScreen } from "../../components/SplashScreen";
import { appServicesToken, appServicesLogout } from "../../authConfig";
import axios, { AxiosError } from "axios";
import {
    Popover,
    Typography,
    Button,
    Avatar,
    IconButton,
    Divider,
    Box
} from "@mui/material";
import { Close } from "@mui/icons-material";

const Layout = () => {
    const { instance, accounts } = useMsal();
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [userInitials, setUserInitials] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>("");
    const [userEmail, setUserEmail] = useState<string>("");
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const [isLoggingOut, setIsLoggingOut] = useState(false); 

    useEffect(() => {
        const checkAuthStatus = async () => {
            if (isLoggingOut) return; // Prevent navigation while logout is in progress
    
            const activeAccount = instance.getActiveAccount();
            if (activeAccount || appServicesToken) {
                setIsLoggedIn(true);
    
                const storedProfile = localStorage.getItem("userProfile");
                const storedPicture = localStorage.getItem("userProfilePicture");
    
                if (storedProfile) {
                    const userData = JSON.parse(storedProfile);
                    setUserName(userData.name);
                    setUserEmail(userData.email);
                    setUserInitials(userData.initials);
                }
    
                if (storedPicture) {
                    setProfilePicture(storedPicture);
                } else {
                    await fetchUserProfile();
                }
            } else {
                setIsLoggedIn(false);
            }
        };
    
        checkAuthStatus();
    
        const accountListener = instance.addEventCallback((event) => {
            if (event.eventType === EventType.LOGIN_SUCCESS) {
                setIsLoggedIn(true);
                fetchUserProfile();
                navigate("/", { replace: true });
            } else if (event.eventType === EventType.LOGOUT_SUCCESS) {
                if (!isLoggingOut) { // Prevent automatic navigation if already logging out manually
                    setIsLoggedIn(false);
                    setProfilePicture(null);
                    setUserInitials(null);
                    setUserName("");
                    setUserEmail("");
    
                    localStorage.removeItem("userProfile");
                    localStorage.removeItem("userProfilePicture");
    
                    navigate("/");
                }
            }
        });
    
        return () => {
            if (accountListener) {
                instance.removeEventCallback(accountListener);
            }
        };
    }, [instance, accounts, navigate, isLoggingOut]); 
    
    

    const fetchUserProfile = async () => {
        try {
            const activeAccount = instance.getActiveAccount();
            if (!activeAccount) {
                console.error("No active account found.");
                return;
            }
    
            const tokenResponse = await instance.acquireTokenSilent({
                scopes: ["https://graph.microsoft.com/User.Read"],
                account: activeAccount,
            });
    
            if (!tokenResponse.accessToken) {
                console.error("Failed to acquire access token.");
                return;
            }
    
            const profileResponse = await axios.get("https://graph.microsoft.com/v1.0/me", {
                headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
            });
    
            const { givenName, surname, mail } = profileResponse.data;
            const initials = (givenName?.charAt(0) || "") + (surname?.charAt(0) || "");
    
            const userData = {
                name: `${givenName} ${surname}`,
                email: mail || "No Email",
                initials: initials.toUpperCase(),
            };
    
            setUserName(userData.name);
            setUserEmail(userData.email);
            setUserInitials(userData.initials);
            localStorage.setItem("userProfile", JSON.stringify(userData));
    
            try {
                const pictureResponse = await axios.get("https://graph.microsoft.com/v1.0/me/photo/$value", {
                    headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
                    responseType: "blob",
                });
    
                const base64Image = await blobToBase64(pictureResponse.data);
                setProfilePicture(base64Image);
                localStorage.setItem("userProfilePicture", base64Image);
            } catch (error: unknown) {
                console.warn("No profile picture found, using initials.");
                setProfilePicture(null);
                localStorage.removeItem("userProfilePicture");
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    };
    

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };
    
   const handleLogout = async () => {
    const activeAccount = instance.getActiveAccount();
    if (activeAccount) {
        try {
            setIsLoggingOut(true); // Prevent immediate navigation
            
            await instance.logoutPopup({ account: activeAccount }); // Wait for user confirmation
            
            // Clear user state and local storage after successful logout
            localStorage.removeItem("userProfile");
            localStorage.removeItem("userProfilePicture");

            setIsLoggedIn(false);
            setProfilePicture(null);
            setUserInitials(null);
            setUserName("");
            setUserEmail("");

            // Close the popover
            setAnchorEl(null);

            navigate("/"); // Now navigate after logout is confirmed
        } catch (error) {
            console.error("Logout failed:", error);
            setIsLoggingOut(false); // Reset state if logout fails
        }
    } else {
        appServicesLogout();
        setAnchorEl(null);
        setIsLoggedIn(false);
        navigate("/");
    }
};
    

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? "profile-popover" : undefined;

    if (isLoggedIn === null) {
        return <SplashScreen />;
    }

    return isLoggedIn ? (
        <div className={styles.layout}>
            <div className={styles.mainContent}>
                <header className={styles.header} role="banner">
                    <img
                        src="https://d3iejrrnx79bo4.cloudfront.net/TRuskvdDfoOGqAvyjyWm.png"
                        alt="Logo"
                        style={{ height: "30px", marginRight: "10px", cursor: 'pointer' }}
                    />

                    <div className={styles.logoutContainer}>
                        {/* Profile Avatar (Opens Popover) */}
                        <Avatar
                            src={profilePicture || undefined}
                            sx={{ width: 45, height: 45, cursor: "pointer", bgcolor: profilePicture ? "transparent" : "#0078D4" }}
                            onClick={handleClick}
                        >
                            {!profilePicture && userInitials}
                        </Avatar>

                        {/* Popover Menu */}
                        <Popover
                            id={id}
                            open={open}
                            anchorEl={anchorEl}
                            onClose={handleClose}
                            anchorOrigin={{
                                vertical: "bottom",
                                horizontal: "right",
                            }}
                            transformOrigin={{
                                vertical: "top",
                                horizontal: "right",
                            }}
                            sx={{ marginTop: 1 }}
                        >

                            <Box sx={{ width: 350, p: 2, display: "flex", flexDirection: "column" }}>

                                <IconButton
                                    sx={{ position: "absolute", right: 8, top: 8 }}
                                    onClick={handleClose} size="small">
                                    <Close />
                                </IconButton>

                                <Typography variant="subtitle1" fontWeight="bold">
                                    Profile
                                </Typography>

                                <Divider className="mt-2" />

                                <Box sx={{ mt: 3, display: 'flex', width: 'auto' }}>
                                    {/* User Image and Role */}
                                    <Avatar
                                        src={profilePicture || undefined}
                                        sx={{ width: 80, height: 80, mx: "10px", bgcolor: profilePicture ? "transparent" : "#0078D4" }}
                                    >
                                        {!profilePicture && userInitials}
                                    </Avatar>

                                    <div >
                                        <div>
                                            <Typography variant="caption"
                                                sx={{ bgcolor: "#019ba7", color: 'white', borderRadius: "12px", px: 2, py: 0.5, mt: 1 }}>
                                                Workspace Owner
                                            </Typography>
                                        </div>
                                        <div>
                                            <Typography variant="caption"
                                                sx={{ fontWeight: "bold", mt: 1 }}>
                                                {userName}
                                            </Typography>
                                        </div>
                                        <div>
                                            <Typography variant="caption"
                                                sx={{ color: "text.secondary" }}>
                                                {userEmail}
                                            </Typography>
                                        </div>
                                        <div>
                                            <Typography
                                                variant="caption"
                                                sx={{ color: "primary.main", cursor: "pointer", mt: 1 }}>
                                                View Profile
                                            </Typography>
                                        </div>
                                    </div>
                                </Box>

                                {/* Sign Out Button */}
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    sx={{ mt: 2, borderColor: "orange", color: "orange" }}
                                    onClick={handleLogout}
                                >
                                    Sign Out
                                </Button>
                            </Box>
                        </Popover>
                    </div>
                </header>

                <main className={styles.pageContent}>
                    <Outlet />
                </main>
            </div>
        </div>
    ) : (
        <SplashScreen />
    );
};

export default Layout;
