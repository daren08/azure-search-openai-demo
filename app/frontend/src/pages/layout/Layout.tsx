import React, { useState, useEffect, useRef, RefObject } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./Layout.module.css";

import { useLogin } from "../../authConfig";

import { LoginButton } from "../../components/LoginButton";
import { IconButton } from "@fluentui/react";
import { Info24Regular } from "@fluentui/react-icons";

const Layout = () => {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef: RefObject<HTMLDivElement> = useRef(null);

    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setMenuOpen(false);
        }
    };

    useEffect(() => {
        if (menuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuOpen]);

    return (
        <div className={styles.layout}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.logoSection}>
                    <img src="/pow_whiddon.svg" alt="Whiddon logo" className={styles.logo} />
                </div>

                <button className={styles.newChatBtn} style={{display: 'none'}}>+ New Chat</button>
            </aside>

            {/* Main content area */}
            <div className={styles.main}>
                {/* Top bar */}
                <header className={`${styles.header} flex items-center`} style={{ justifyContent: "space-between" }}>
                    <h1 className={styles.headerTitle}>Assistant.AI</h1>
                    <Info24Regular style={{ color: "#4ec0ad" }} />
                </header>

                {/* Whatever the rest of your routes/pages are */}
                <div className={styles.content}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default Layout;
