import { useMemo, useState, useEffect } from "react";
import { Stack, Modal, TextField, PrimaryButton, DefaultButton } from "@fluentui/react";
import { IconButton } from "@mui/material";
import { Lightbulb, Assignment, ThumbUp, ThumbDown } from "@mui/icons-material"
import DOMPurify from "dompurify";

import styles from "./Answer.module.css";
import { ChatAppResponse, getCitationFilePath } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";
import { SpeechOutputBrowser } from "./SpeechOutputBrowser";
import { SpeechOutputAzure } from "./SpeechOutputAzure";
import style from "react-syntax-highlighter/dist/esm/styles/hljs/a11y-dark";

interface Props {
    answer: ChatAppResponse;
    isSelected?: boolean;
    isStreaming: boolean;
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
    const [like, setLike] = useState<boolean | null>(null);
    const [dislike, setDislike] = useState<boolean | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [reason, setReason] = useState<string>("");
    const [isSupportingContentVisible, setIsSupportingContentVisible] = useState<boolean>(false);

    const followupQuestions = answer.context?.followup_questions;
    const messageContent = answer.message.content;
    const parsedAnswer = useMemo(() => parseAnswerToHtml(messageContent, isStreaming, onCitationClicked), [answer]);

    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);

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

    const handleModalClose = () => {
        setIsModalOpen(false);
        setReason("");
    };

    const handleReasonChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setReason(newValue || "");
    };

    const handleSubmitReason = () => {
        console.log("Reason for dislike:", reason);
        handleModalClose();
    };

    const handleSupportingContentClick = () => {
        setIsSupportingContentVisible(!isSupportingContentVisible);
        onSupportingContentClicked();
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
                        ><Assignment /></IconButton>
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

            {!!followupQuestions?.length && showFollowupQuestions && onFollowupQuestionClicked && (
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
                        <DefaultButton onClick={handleSubmitReason} text="Submit" className={styles.modalSubmitBtn} />
                        <DefaultButton onClick={handleModalClose} text="Cancel" className={styles.modalCloseBtn} />
                    </Stack>
                </div>
            </Modal>
        </Stack>
    );
};
