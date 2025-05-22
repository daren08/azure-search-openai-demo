import axios from "axios";
import { PublicClientApplication } from "@azure/msal-browser";
import { jwtDecode } from "jwt-decode";

export const fetchUserProfile = async (instance: PublicClientApplication) => {
    try {
        const activeAccount = instance.getActiveAccount();
        if (!activeAccount) {
            console.error("No active account found.");
            return null;
        }

        let userRole = "";
        if (activeAccount && activeAccount.idToken) {
            const decoded: any = jwtDecode(activeAccount.idToken);
            const roles = decoded.roles || decoded.role || [];
            userRole = Array.isArray(roles) ? roles[0] : roles;
        }      

        const tokenResponse = await instance.acquireTokenSilent({
            scopes: ["https://graph.microsoft.com/User.Read"],
            account: activeAccount,
        });

        if (!tokenResponse.accessToken) {
            console.error("Failed to acquire access token.");
            return null;
        }

        const profileResponse = await axios.get("https://graph.microsoft.com/v1.0/me", {
            headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
        });

        const { givenName, surname, mail, id } = profileResponse.data;

        const initials = givenName ? (givenName?.charAt(0) || "") + (surname?.charAt(0) || "") : activeAccount?.name?.charAt(0) || "";

        const userData = {
            name: givenName ? `${givenName} ${surname}` : activeAccount?.name || "",
            email: mail || tokenResponse.account.username,
            initials: initials.toUpperCase(),
            role: userRole,
            userId: id
        };

        localStorage.setItem("whiddon-userProfile", JSON.stringify(userData));

        try {
            const pictureResponse = await axios.get("https://graph.microsoft.com/v1.0/me/photo/$value", {
                headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
                responseType: "blob",
            });

            const base64Image = await blobToBase64(pictureResponse.data);
            localStorage.setItem("whiddon-userProfilePicture", base64Image);
        } catch (error) {
            console.warn("No profile picture found, using initials.");
            localStorage.removeItem("whiddon-userProfilePicture");
        }

        return userData;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
