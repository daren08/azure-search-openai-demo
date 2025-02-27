import { Example } from "./Example";
import { useTranslation } from "react-i18next";

import styles from "./Example.module.css";

interface Props {
    onExampleClicked: (value: string) => void;
    useGPT4V?: boolean;
}

export const ExampleList = ({ onExampleClicked, useGPT4V }: Props) => {
    const { t } = useTranslation();

    const DEFAULT_EXAMPLES: string[] = [t("defaultExamples.1"), t("defaultExamples.2"), t("defaultExamples.3")];
    const GPT4V_EXAMPLES: string[] = [t("gpt4vExamples.1"), t("gpt4vExamples.2"), t("gpt4vExamples.3")];

    const backgroundColors = ["#4ec0ad", "#f36f4c", "#e3e0d1"];  

    return (
        <ul className={styles.examplesNavList}>
            {(useGPT4V ? GPT4V_EXAMPLES : DEFAULT_EXAMPLES).map((question, i) => (
                <li key={i}>
                    <Example 
                    text={question} 
                    value={question} 
                    bgColor={backgroundColors[i % backgroundColors.length]} 
                    onClick={onExampleClicked}/>
                </li>
            ))}
        </ul>
    );
};
