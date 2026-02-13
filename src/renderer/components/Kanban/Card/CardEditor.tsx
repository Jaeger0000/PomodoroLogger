import React, { FC, useEffect, useState, KeyboardEvent } from 'react';
import { connect } from 'react-redux';
import { actions, CardActionTypes } from './action';
import { actions as kanbanActions } from '../action';
import { RootState } from '../../../reducers';
import ReactHotkeys from 'react-hot-keys';
import { genMapDispatchToProp } from '../../../utils';
import {
    Button,
    Col,
    Form,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Row,
    Tabs,
    Checkbox,
    Icon,
} from 'antd';
import TextArea from 'antd/es/input/TextArea';
import shortid from 'shortid';
import { Card, SubTask } from '../type';
import { Markdown } from '../style/Markdown';
import formatMarkdown from './formatMarkdown';
import { EditorContainer } from '../style/editorStyle';
import styled from 'styled-components';

const { TabPane } = Tabs;

const SubTaskContainer = styled.div`
    margin-top: 16px;

    .subtask-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-weight: 500;
    }

    .subtask-item {
        display: flex;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid #f0f0f0;

        &:last-child {
            border-bottom: none;
        }

        .subtask-checkbox {
            margin-right: 8px;
        }

        .subtask-title {
            flex: 1;
            padding: 0 8px;

            &.completed {
                text-decoration: line-through;
                color: #999;
            }
        }

        .subtask-actions {
            display: flex;
            gap: 8px;
        }
    }

    .subtask-input-row {
        display: flex;
        gap: 8px;
        margin-top: 8px;
    }
`;

interface Props extends CardActionTypes {
    visible: boolean;
    onCancel: () => void;
    card?: Card;
    form: any;
    listId: string;
}

interface FormData {
    title: string;
    content: string;
    estimatedTime?: number;
    actualTime?: number;
}

const _CardInDetail: FC<Props> = React.memo((props: Props) => {
    const [showMarkdownPreview, setShowMarkdownPreview] = useState(true);
    const [cardContent, setCardContent] = useState('');
    const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
    const [editingSubTaskId, setEditingSubTaskId] = useState<string | null>(null);
    const [editingSubTaskTitle, setEditingSubTaskTitle] = useState('');

    const { card, visible, form, onCancel, listId } = props;
    const isCreating = !card;
    const lastIsCreating = React.useRef<boolean | null>(null);
    const thisIsCreating = visible ? isCreating : lastIsCreating.current ?? isCreating;
    const { getFieldDecorator, setFieldsValue, validateFields, resetFields } = form;
    useEffect(() => {
        lastIsCreating.current = isCreating;
    }, [isCreating]);
    useEffect(() => {
        if (!visible) {
            return;
        }

        setIsEditingActualTime(false);
        if (card) {
            setShowMarkdownPreview(true);
            const time = card.spentTimeInHour.estimated;
            const actual = card.spentTimeInHour.actual;
            setCardContent(card.content);
            setFieldsValue({
                title: card.title,
                content: card.content,
                estimatedTime: time ? time : undefined,
                actualTime: actual ? actual : undefined,
            } as FormData);
        } else {
            setCardContent('');
            setShowMarkdownPreview(false);
            setFieldsValue({
                title: '',
                content: '',
                estimatedTime: undefined,
                actualTime: undefined,
            } as FormData);
        }
    }, [card, visible]);

    const onDelete = React.useCallback(() => {
        if (!card) {
            return;
        }

        props.deleteCard(card._id, listId);
        onCancel();
    }, [card?._id, listId, onCancel]);

    const [isEditingActualTime, setIsEditingActualTime] = useState(false);
    const onSwitchIsEditing = () => {
        setIsEditingActualTime(!isEditingActualTime);
    };

    const handleAddSubTask = React.useCallback(() => {
        if (!card || !newSubTaskTitle.trim()) return;

        props.addSubTask(card._id, newSubTaskTitle.trim());
        setNewSubTaskTitle('');
    }, [card, newSubTaskTitle, props]);

    const handleToggleSubTask = React.useCallback(
        (subTaskId: string) => {
            if (!card) return;
            props.toggleSubTask(card._id, subTaskId);
        },
        [card, props]
    );

    const handleDeleteSubTask = React.useCallback(
        (subTaskId: string) => {
            if (!card) return;
            props.deleteSubTask(card._id, subTaskId);
        },
        [card, props]
    );

    const handleStartEdit = React.useCallback((subTask: SubTask) => {
        setEditingSubTaskId(subTask._id);
        setEditingSubTaskTitle(subTask.title);
    }, []);

    const handleSaveEdit = React.useCallback(() => {
        if (!card || !editingSubTaskId || !editingSubTaskTitle.trim()) return;

        props.updateSubTask(card._id, editingSubTaskId, editingSubTaskTitle.trim());
        setEditingSubTaskId(null);
        setEditingSubTaskTitle('');
    }, [card, editingSubTaskId, editingSubTaskTitle, props]);

    const handleCancelEdit = React.useCallback(() => {
        setEditingSubTaskId(null);
        setEditingSubTaskTitle('');
    }, []);

    const saveValues = ({ title, content, estimatedTime, actualTime }: FormData) => {
        const time = estimatedTime || 0;
        setCardContent(content || '');
        if (!card) {
            // Creating
            const _id = shortid.generate();
            props.addCard(_id, listId, title, content);
            props.setEstimatedTime(_id, time);
        } else {
            // Edit
            props.renameCard(card._id, title);
            props.setContent(card._id, content);
            props.setEstimatedTime(card._id, time);
            if (actualTime !== undefined) {
                props.setActualTime(card._id, actualTime);
            }
        }
    };

    const onSave = () => {
        validateFields((err: Error, values: FormData) => {
            if (err) {
                throw err;
            }

            saveValues(values);
            setTimeout(resetFields, 200);
            onCancel();
        });
    };

    const keydownEventHandler = React.useCallback(
        (event: KeyboardEvent<any>) => {
            if (
                (event.ctrlKey || event.altKey || event.shiftKey) &&
                (event.which === 13 || event.keyCode === 13)
            ) {
                onSave();
            } else if (event.keyCode === 27) {
                onCancel();
                event.stopPropagation();
            }
        },
        [onSave, onCancel]
    );

    const onTabChange = React.useCallback((name: string) => {
        if (name === 'edit') {
            setShowMarkdownPreview(false);
        } else {
            validateFields((err: Error, values: FormData) => {
                setCardContent(values.content || '');
                setShowMarkdownPreview(true);
            });
        }
    }, []);

    return (
        <Modal
            visible={visible}
            title={thisIsCreating ? 'Create a new card' : 'Edit'}
            okText={thisIsCreating ? 'Create' : 'Save'}
            onCancel={onCancel}
            cancelButtonProps={{ style: { display: 'none' } }}
            style={{ minWidth: 300 }}
            width={'60vw'}
            onOk={onSave}
        >
            <EditorContainer>
                <Form layout="vertical" onKeyDown={keydownEventHandler}>
                    <Form.Item label="Title">
                        {getFieldDecorator('title', {
                            rules: [{ required: true, message: 'Please input the name of board!' }],
                        })(<Input placeholder={'Title'} onKeyDown={keydownEventHandler} />)}
                    </Form.Item>
                    <Tabs
                        onChange={onTabChange}
                        type="card"
                        activeKey={showMarkdownPreview ? 'preview' : 'edit'}
                        style={{ marginBottom: 10, minHeight: 120 }}
                    >
                        <TabPane tab="Edit" key="edit">
                            {getFieldDecorator('content')(
                                <TextArea
                                    autoSize={{ minRows: 6 }}
                                    placeholder={'Description'}
                                    onKeyDown={keydownEventHandler}
                                />
                            )}
                        </TabPane>
                        <TabPane tab="Preview" key="preview">
                            <Markdown
                                style={{
                                    padding: '0px 10px',
                                    border: '1px solid rgb(220, 220, 220)',
                                    borderRadius: 4,
                                    maxHeight: 'calc(100vh - 600px)',
                                    minHeight: 120,
                                }}
                                dangerouslySetInnerHTML={{
                                    __html: formatMarkdown(cardContent || ''),
                                }}
                            />
                        </TabPane>
                    </Tabs>
                    <Row>
                        <Col span={12}>
                            <Form.Item label="Estimated Time In Hour">
                                {getFieldDecorator('estimatedTime')(
                                    <InputNumber
                                        min={0}
                                        max={100}
                                        step={0.5}
                                        precision={1}
                                        placeholder={'Estimated Time In Hour'}
                                    />
                                )}
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            {thisIsCreating ? undefined : (
                                <Form.Item label="Actual Spent Time In Hour">
                                    {getFieldDecorator('actualTime')(
                                        <InputNumber
                                            disabled={!isEditingActualTime}
                                            precision={2}
                                            min={0}
                                            step={0.2}
                                            placeholder={'Actual Time In Hour'}
                                        />
                                    )}
                                    <Button
                                        style={{ marginLeft: 4 }}
                                        icon={isEditingActualTime ? 'unlock' : 'lock'}
                                        shape={'circle-outline'}
                                        onClick={onSwitchIsEditing}
                                    />
                                </Form.Item>
                            )}
                        </Col>
                    </Row>

                    {/* SubTasks Section */}
                    {!thisIsCreating && card && (
                        <SubTaskContainer>
                            <div className="subtask-header">
                                <span>Subtasks ({card.subTasks?.length || 0})</span>
                            </div>

                            {card.subTasks && card.subTasks.length > 0 && (
                                <div>
                                    {card.subTasks.map((subTask) => (
                                        <div key={subTask._id} className="subtask-item">
                                            <Checkbox
                                                className="subtask-checkbox"
                                                checked={subTask.completed}
                                                onChange={() => handleToggleSubTask(subTask._id)}
                                            />
                                            {editingSubTaskId === subTask._id ? (
                                                <>
                                                    <Input
                                                        value={editingSubTaskTitle}
                                                        onChange={(e) =>
                                                            setEditingSubTaskTitle(e.target.value)
                                                        }
                                                        onPressEnter={handleSaveEdit}
                                                        size="small"
                                                        style={{ flex: 1, marginRight: 8 }}
                                                    />
                                                    <div className="subtask-actions">
                                                        <Button
                                                            size="small"
                                                            type="primary"
                                                            icon="check"
                                                            onClick={handleSaveEdit}
                                                        />
                                                        <Button
                                                            size="small"
                                                            icon="close"
                                                            onClick={handleCancelEdit}
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <span
                                                        className={`subtask-title ${
                                                            subTask.completed ? 'completed' : ''
                                                        }`}
                                                    >
                                                        {subTask.title}
                                                    </span>
                                                    <div className="subtask-actions">
                                                        <Button
                                                            size="small"
                                                            icon="edit"
                                                            onClick={() => handleStartEdit(subTask)}
                                                        />
                                                        <Popconfirm
                                                            title="Delete this subtask?"
                                                            onConfirm={() =>
                                                                handleDeleteSubTask(subTask._id)
                                                            }
                                                        >
                                                            <Button
                                                                size="small"
                                                                icon="delete"
                                                                type="danger"
                                                            />
                                                        </Popconfirm>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="subtask-input-row">
                                <Input
                                    placeholder="Add a new subtask..."
                                    value={newSubTaskTitle}
                                    onChange={(e) => setNewSubTaskTitle(e.target.value)}
                                    onPressEnter={handleAddSubTask}
                                    size="small"
                                />
                                <Button
                                    type="primary"
                                    icon="plus"
                                    onClick={handleAddSubTask}
                                    size="small"
                                    disabled={!newSubTaskTitle.trim()}
                                >
                                    Add
                                </Button>
                            </div>
                        </SubTaskContainer>
                    )}

                    {thisIsCreating ? undefined : (
                        <Row>
                            <Popconfirm title={'Are you sure?'} onConfirm={onDelete}>
                                <Button type={'danger'} icon={'delete'}>
                                    Delete
                                </Button>
                            </Popconfirm>
                        </Row>
                    )}
                </Form>
            </EditorContainer>
        </Modal>
    );
});

export const CardInDetail = connect(
    (state: RootState) => {
        const { isEditing, _id, listId } = state.kanban.kanban.editCard;
        return {
            listId,
            card: _id === undefined ? undefined : state.kanban.cards[_id],
            visible: isEditing,
        };
    },
    genMapDispatchToProp<CardActionTypes>({
        ...actions,
        onCancel: () => (dispatch: any) =>
            dispatch(kanbanActions.setEditCard(false, '', undefined)),
    })
)(Form.create({})(_CardInDetail));
