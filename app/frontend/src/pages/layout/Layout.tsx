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
import { UserProfile } from "../../components/UserProfile/UserProfile";

const Layout = () => {
    const { instance, accounts } = useMsal();
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [userInitials, setUserInitials] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>("");
    const [userEmail, setUserEmail] = useState<string>("");
    const [userRole, setUserRole] = useState<string>("No Role");
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        const checkAuthStatus = async () => {
            if (isLoggingOut) return; // Prevent navigation while logout is in progress

            const activeAccount = instance.getActiveAccount();
            if (activeAccount || appServicesToken) {
                setIsLoggedIn(true);

                const storedProfile = localStorage.getItem("whiddon-userProfile");
                const storedPicture = localStorage.getItem("whiddon-userProfilePicture");

                if (storedProfile) {
                    const userData = JSON.parse(storedProfile);
                    setUserName(userData.name);
                    setUserEmail(userData.email);
                    setUserInitials(userData.initials);
                    setUserRole(userData.role || "No Role");
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
                    setUserRole("No Role");

                    localStorage.removeItem("whiddon-userProfile");
                    localStorage.removeItem("whiddon-userProfilePicture");

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

            const { givenName, surname, mail, jobTitle } = profileResponse.data;
            const initials = (givenName?.charAt(0) || "") + (surname?.charAt(0) || "");

            const userData = {
                name: `${givenName} ${surname}`,
                email: mail || "No Email",
                initials: initials.toUpperCase(),
                role: jobTitle || "No Role"
            };

            setUserName(userData.name);
            setUserEmail(userData.email);
            setUserInitials(userData.initials);
            setUserRole(userData.role);
            localStorage.setItem("whiddon-userProfile", JSON.stringify(userData));

            try {
                const pictureResponse = await axios.get("https://graph.microsoft.com/v1.0/me/photo/$value", {
                    headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
                    responseType: "blob",
                });

                const base64Image = await blobToBase64(pictureResponse.data);
                setProfilePicture(base64Image);
                localStorage.setItem("whiddon-userProfilePicture", base64Image);
            } catch (error: unknown) {
                console.warn("No profile picture found, using initials.");
                setProfilePicture(null);
                localStorage.removeItem("whiddon-userProfilePicture");
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
                localStorage.removeItem("whiddon-userProfile");
                localStorage.removeItem("whiddon-userProfilePicture");

                setIsLoggedIn(false);
                setProfilePicture(null);
                setUserInitials(null);
                setUserName("");
                setUserEmail("");
                setUserRole("No Role");

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

                    <UserProfile
                        isLoggedIn={isLoggedIn}
                        userName={userName}
                        userEmail={userEmail}
                        userInitials={userInitials || ''}
                        profilePicture={profilePicture}
                        onLogin={async () => {
                            // Add login logic here
                        }}
                        onLogout={handleLogout}
                    />
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
