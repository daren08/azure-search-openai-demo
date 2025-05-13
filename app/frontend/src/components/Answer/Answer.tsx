import { useMemo, useState, useEffect } from "react";
import { Stack, IconButton, Modal, PrimaryButton, DefaultButton, TextField } from "@fluentui/react";
import {ThumbUp, ThumbDown, Assignment} from "@mui/icons-material";
import DOMPurify from "dompurify";

import styles from "./Answer.module.css";
import { ChatAppResponse, getCitationFilePath } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";
import { SpeechOutputBrowser } from "./SpeechOutputBrowser";
import { SpeechOutputAzure } from "./SpeechOutputAzure";

interface Props {
    answer: ChatAppResponse;
    isSelected?: boolean;
    isStreaming: boolean;
    // onCitationClicked: (filePath: string) => void;
    onCitationClicked: (filePath: string, showSidePanel?: boolean) => void;
    onThoughtProcessClicked: () => void;
    onSupportingContentClicked: () => void;
    onFollowupQuestionClicked?: (question: string) => void;
    showFollowupQuestions?: boolean;
    showSpeechOutputBrowser?: boolean;
    showSpeechOutputAzure?: boolean;
    speechUrl: string | null;
}

export const Answer = ({
    answer,
    isSelected,
    isStreaming,
    onCitationClicked,
    onThoughtProcessClicked,
    onSupportingContentClicked,
    onFollowupQuestionClicked,
    showFollowupQuestions,
    showSpeechOutputAzure,
    showSpeechOutputBrowser,
    speechUrl
}: Props) => {
    const [isSupportingContentVisible, setIsSupportingContentVisible] = useState<boolean>(false);
    const [like, setLike] = useState<boolean | null>(null);
    const [dislike, setDislike] = useState<boolean | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [reason, setReason] = useState<string>("");
    const followupQuestions = answer.context?.followup_questions;

    const messageContent = answer.message.content;
    const parsedAnswer = useMemo(() => parseAnswerToHtml(messageContent, isStreaming, onCitationClicked), [answer]);

    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);

    const handleReasonChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setReason(newValue || "");
    };

    
    const handleLikeClick = () => {
        if (like) {
            setLike(null);
        } else {
            setLike(true);
            setDislike(null);
        }
        console.log("Liked");
    };

    const handleDislikeClick = () => {
        if (dislike) {
            setDislike(null);
        } else {
            setDislike(true);
            setLike(null);
            setIsModalOpen(true);
        }
        console.log("Disliked");
    };

    const handleSupportingContentClick = () => {
        setIsSupportingContentVisible(!isSupportingContentVisible);
        onSupportingContentClicked();
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setReason("");
    };

    useEffect(() => {
        if (!isModalOpen) {
            setIsSupportingContentVisible(false);
        }
    }, [isModalOpen]);

    return (
        <Stack className={`${styles.answerContainer} ${isSelected && styles.selected}`} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon />
                    <div>
                    <IconButton
                            title={isSupportingContentVisible ? "Hide supporting content" : "Show supporting content"}
                            onClick={handleSupportingContentClick}
                            disabled={!answer.context.data_points}
                        ><Assignment/></IconButton> 
                        <IconButton
                            style={{ color: like ? "#f36f4c" : "#727272" }}
                            title="Like"
                            onClick={handleLikeClick}
                        ><ThumbUp /></IconButton>
                        <IconButton
                            style={{ color: dislike ? "#f36f4c" : "#727272" }}
                            title="Dislike"
                            onClick={handleDislikeClick}
                        ><ThumbDown /></IconButton>
                        {/* <IconButton
                            style={{ color: "black" }}
                            iconProps={{ iconName: "Lightbulb" }}
                            title="Show thought process"
                            ariaLabel="Show thought process"
                            onClick={() => onThoughtProcessClicked()}
                            disabled={!answer.context.thoughts?.length}
                        /> */}
                       
                        {showSpeechOutputAzure && <SpeechOutputAzure url={speechUrl} />}
                        {showSpeechOutputBrowser && <SpeechOutputBrowser answer={sanitizedAnswerHtml} />}
                    </div>
                </Stack>
            </Stack.Item>

            <Stack.Item grow>
                <div className={styles.answerText} dangerouslySetInnerHTML={{ __html: sanitizedAnswerHtml }}></div>
            </Stack.Item>

            {!!parsedAnswer.citations.length && (
                <Stack.Item>
                    <Stack horizontal wrap tokens={{ childrenGap: 5 }}>
                        <span className={styles.citationLearnMore}>Citations:</span>
                        {parsedAnswer.citations.map((x, i) => {
                            const path = getCitationFilePath(x);
                            return (
                                <a key={i} className={styles.citation} title={x} onClick={() => onCitationClicked(path, false)}>
                                    {`${++i}. ${x}`}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )}

            {/* {!!followupQuestions?.length && showFollowupQuestions && onFollowupQuestionClicked && (
                <Stack.Item>
                    <Stack horizontal wrap className={`${!!parsedAnswer.citations.length ? styles.followupQuestionsList : ""}`} tokens={{ childrenGap: 6 }}>
                        <span className={styles.followupQuestionLearnMore}>Follow-up questions:</span>
                        {followupQuestions.map((x, i) => {
                            return (
                                <a key={i} className={styles.followupQuestion} title={x} onClick={() => onFollowupQuestionClicked(x)}>
                                    {`${x}`}
                                </a>
                            );
                        })}
                    </Stack>
                </Stack.Item>
            )} */}

{!!followupQuestions?.length && showFollowupQuestions && onFollowupQuestionClicked && (
    <Stack.Item>
        <div className={styles.followupQuestionSection}>
            <span className={styles.followupQuestionLearnMore}>Follow-up Questions:</span>
            <ul className={styles.followupQuestionList}>
                {followupQuestions.map((x, i) => (
                    <li key={i}>
                        <a
                            className={styles.followupQuestionLink}
                            title={x}
                            onClick={() => onFollowupQuestionClicked(x)}
                        >
                            <em>{x}</em>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    </Stack.Item>
)}

<Modal
                isOpen={isModalOpen}
                onDismiss={handleModalClose}
                isBlocking={false}
                containerClassName={styles.modalContainer}
            >
                <div className={styles.modalHeader}>
                    <h2>Reason for Dislike</h2>
                </div>
                <div className={styles.modalBody}>
                    <TextField
                        label="Please provide a reason for your dislike:"
                        multiline
                        rows={3}
                        value={reason}
                        onChange={handleReasonChange}
                    />
                </div>
                <div className={styles.modalFooter}>
                    <Stack horizontal tokens={{ childrenGap: 10 }}>
                        <DefaultButton onClick={handleModalClose} text="Submit" className={styles.modalSubmitBtn} />
                        <DefaultButton onClick={handleModalClose} text="Cancel" className={styles.modalCloseBtn} />
                    </Stack>
                </div>
            </Modal>

        </Stack>
    );
};
