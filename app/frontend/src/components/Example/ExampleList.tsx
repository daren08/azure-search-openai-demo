import { Example } from "./Example";

import styles from "./Example.module.css";

const DEFAULT_EXAMPLES: string[] = [
    // "What is included in my Northwind Health Plus plan that is not in standard?",
    "What's in RAC Grief  Bereavement Protocol 24?",
    "What happens in a GOV Dignity of Risk Policy 2024?",
    "Summarize Infection Control Policy?"
];

const GPT4V_EXAMPLES: string[] = [
    "Compare the impact of interest rates and GDP in financial markets.",
    "What is the expected trend for the S&P 500 index over the next five years? Compare it to the past S&P 500 performance",
    "Can you identify any correlation between oil prices and stock market trends?"
];

interface Props {
    onExampleClicked: (value: string) => void;
    useGPT4V?: boolean;
}

export const ExampleList = ({ onExampleClicked, useGPT4V }: Props) => {
    const backgroundColors = ["#4ec0ad", "#f36f4c", "#e3e0d1"];  
    const fonColors = ["#342E37", "#F2F2F2", "#342E37"];

    return (
        <ul className={styles.examplesNavList}>
            {(useGPT4V ? GPT4V_EXAMPLES : DEFAULT_EXAMPLES).map((question, i) => (
                <li key={i}>
                    <Example text={question} value={question} 
                    bgColor={backgroundColors[i % backgroundColors.length]} 
                    fontColor={fonColors[i % fonColors.length]}
                    onClick={onExampleClicked} />
                </li>
            ))}
        </ul>
    );
};
