import styles from "./Example.module.css";

interface Props {
    text: string;
    value: string;
    bgColor: string;
    fontColor: string,
    onClick: (value: string) => void;
}

export const Example = ({ text, value, bgColor, fontColor, onClick }: Props) => {
    return (
        <div className={styles.example} onClick={() => onClick(value)} style={{ backgroundColor: bgColor, color: fontColor }}>
            <p className={styles.exampleText}>{text}</p>
        </div>
    );
};
