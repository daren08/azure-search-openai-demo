import { Outlet, Link, useNavigate } from "react-router-dom";
import axios, { AxiosError } from "axios";
import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { EventType } from "@azure/msal-browser"; // ✅ Import correct event type
import styles from "./Layout.module.css";
import { LoginButton } from "../../components/LoginButton";
import { SplashScreen } from "../../components/SplashScreen";
import { Info24Regular, Add16Regular } from "@fluentui/react-icons"; // Fluent UI info icon
import { appServicesToken, appServicesLogout } from "../../authConfig";
import { DatePicker, defaultDatePickerStrings } from '@fluentui/react/lib/DatePicker';
import { mergeStyleSets } from '@fluentui/react';
import { Avatar, Popover, Box, IconButton, Typography, Divider, Button } from "@mui/material";
import { Close } from "@mui/icons-material";

const useStyles = mergeStyleSets({
    root: {
      display: 'flex',
      marginLeft: '10px',
      marginTop: '10px',
      width: '180px',
      selectors: {
        '.ms-TextField': {
          backgroundColor: '#e8e5d8', // Light beige background
          borderRadius: '999px',      // Fully rounded
          padding: '0 12px',
          height: '40px',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
        },
        '.ms-TextField-fieldGroup': {
          border: 'none',
          backgroundColor: 'transparent',
        },
        '.ms-TextField-field': {
          fontSize: '16px',
          textAlign: 'center',
          backgroundColor: '#e8e5d8 !important'
        },
        '.ms-DatePicker-event--with-label': {
          marginTop: 0,
        },
      },
    },
  });

  
const historyData = {
    today: [
        'Checked Mrs. Jone`s blood pressure – normal',
        'Administered morning medication (Amlodipine)',
        'Prepared light breakfast (oatmeal & fruit)',
        'Updated care notes in HealthCloud',
    ],
    yesterday: [
        'Assisted with afternoon walk – 20 minutes',
        'Refilled water jug and reminded hydration',
        'Checked on medication refill reminder',
        'Brief cognitive exercise session – word recall',
    ],
    '02/09/2025': [
        'Grocery delivery received and unpacked',
        'Prepared lunch – grilled chicken & vegetables',
        'Scheduled upcoming doctor appointment',
        'Discussed sleep quality – no issues reported',
        'Changed bedding and cleaned room',
        'Administered evening medication (Metformin)',
        'Logged vitals: BP 118/76, Pulse 72',
        'Brief conversation about upcoming birthday',
        'Noted improvement in mood and alertness',
    ],
  };

const HistorySection = () => {
    const today = new Date();
    const formattedToday = today.toLocaleDateString('en-US');
    return (
      <div className={styles.historyContainer}>
        <h4>History</h4>
        <div className={styles.historyDateRange}>{formattedToday} - Today</div>
        <hr />
        <div className={styles.historyScroll}>
          {Object.entries(historyData).map(([date, items]) => (
            <div key={date} className={styles.historyGroup}>
              <div className={styles.historyDate}>{date}</div>
              <ul>
                {items.map((item, i) => (
                  <li key={i} className={styles.historyItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
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
        return <SplashScreen />; // ✅ Shows splash screen initially
    }

    return isLoggedIn ? (
        <div className={styles.layout}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarContent}>
                    <Link to="/" className={styles.logoContainer}>
                        <img
                           // src="https://staudiolydevaueast001.blob.core.windows.net/images-blob/pow_whiddon.svg"
                            src="https://images.squarespace-cdn.com/content/67a59b2813e24e4e74f84777/1738906450340-QFO8Z38UYBJU1VF7HO6L/QTX.group.png?format=1000w&content-type=image%2Fpng"
                            alt="Qtx logo"
                            className={styles.logo}
                        />
                    </Link>
                    <div style={{height: '15%', marginBottom: '-20px'}}>
                    <button className={styles.newChatButton}>
                    <Add16Regular/>
                        New Chat
                    </button>
                    </div>
                    <div>
                        <h4 className={styles.viewHistoryLbl}>View History</h4>
                        <div className={useStyles.root} >
                            <DatePicker
                                placeholder="mm/dd/yyyy"
                                ariaLabel="Select a date"
                                strings={defaultDatePickerStrings}
                                allowTextInput={true}
                            />
                         </div>
                         <div className={useStyles.root} >
                            <DatePicker
                                placeholder="mm/dd/yyyy"
                                ariaLabel="Select a date"
                                strings={defaultDatePickerStrings}
                                allowTextInput={true}
                            />
                         </div>
                    </div>
                    <div className={styles.container}>
                       <HistorySection />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className={styles.mainContent}>
                {/* Header */}
                <header className={styles.header} role="banner">
                    <h2 className={styles.headerTitle}>Information Assistant</h2>
                    {/* <div className={styles.logoutContainer}>
                        <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
                        </div> */}
                     <div className={styles.logoutContainer}>
                        <Info24Regular className={styles.infoIcon} title="More Info" />
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

                {/* Page Content */}
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
