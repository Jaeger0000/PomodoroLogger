import { createActionCreator, createReducer } from 'deox';
import { Dispatch } from 'redux';
import { actions as listActions } from '../List/action';
import { workers } from '../../../workers';
import { Card, SubTask } from '../type';
import shortid from 'shortid';

const db = workers.dbWorkers.cardsDB;

export type CardsState = { [_id: string]: Card };

const addSession = createActionCreator(
    '[Card]ADD_SESSION',
    (resolve) => (_id: string, sessionId: string, spentTime: number) =>
        resolve({ _id, sessionId, spentTime })
);

const addCard = createActionCreator(
    '[Card]ADD',
    (resolve) => (_id: string, title?: string, content?: string, createdTime?: number) =>
        resolve({ _id, title, content, createdTime })
);

const renameCard = createActionCreator(
    '[Card]RENAME',
    (resolve) => (_id: string, title: string) => resolve({ _id, title })
);

const setContent = createActionCreator(
    '[Card]SET_CONTENT',
    (resolve) => (_id: string, content: string) => resolve({ _id, content })
);

const setEstimatedTime = createActionCreator(
    '[Card]SET_ESTIMATED_TIME',
    (resolve) => (_id: string, estimatedTime: number) => resolve({ _id, estimatedTime })
);

const setActualTime = createActionCreator(
    '[Card]SET_ACTUAL_TIME',
    (resolve) => (_id: string, actualTime: number) => resolve({ _id, actualTime })
);

const addActualTime = createActionCreator(
    '[Card]ADD_ACTUAL_TIME',
    (resolve) => (_id: string, plus: number) => resolve({ _id, plus })
);

const deleteCard = createActionCreator(
    '[Card]DELETE_CARD',
    (resolve) => (_id: string) => resolve({ _id })
);

const setCards = createActionCreator(
    '[Card]SET_CARDS',
    (resolve) => (cards: CardsState) => resolve(cards)
);

const addSubTask = createActionCreator(
    '[Card]ADD_SUBTASK',
    (resolve) => (cardId: string, subTask: SubTask) => resolve({ cardId, subTask })
);

const toggleSubTask = createActionCreator(
    '[Card]TOGGLE_SUBTASK',
    (resolve) => (cardId: string, subTaskId: string) => resolve({ cardId, subTaskId })
);

const deleteSubTask = createActionCreator(
    '[Card]DELETE_SUBTASK',
    (resolve) => (cardId: string, subTaskId: string) => resolve({ cardId, subTaskId })
);

const updateSubTask = createActionCreator(
    '[Card]UPDATE_SUBTASK',
    (resolve) => (cardId: string, subTaskId: string, title: string) =>
        resolve({ cardId, subTaskId, title })
);

export const actions = {
    fetchCards: () => async (dispatch: Dispatch) => {
        const cards: Card[] = await db.find({}, {});
        const cardMap: CardsState = {};
        for (const card of cards) {
            cardMap[card._id] = card;
        }

        dispatch(setCards(cardMap));
    },
    renameCard: (_id: string, title: string) => async (dispatch: Dispatch) => {
        dispatch(renameCard(_id, title));
        await db.update({ _id }, { $set: { title } });
    },
    setContent: (_id: string, content: string) => async (dispatch: Dispatch) => {
        dispatch(setContent(_id, content));
        await db.update({ _id }, { $set: { content } });
    },
    setEstimatedTime: (_id: string, estimatedTime: number) => async (dispatch: Dispatch) => {
        dispatch(setEstimatedTime(_id, estimatedTime));
        await db.update({ _id }, { $set: { 'spentTimeInHour.estimated': estimatedTime } });
    },
    setActualTime: (_id: string, actualTime: number) => async (dispatch: Dispatch) => {
        dispatch(setActualTime(_id, actualTime));
        await db.update({ _id }, { $set: { 'spentTimeInHour.actual': actualTime } });
    },
    addActualTime: (_id: string, plus: number) => async (dispatch: Dispatch) => {
        dispatch(addActualTime(_id, plus));
        await db.update({ _id }, { $inc: { 'spentTimeInHour.actual': plus } });
    },
    deleteCard: (_id: string, listId: string) => async (dispatch: Dispatch) => {
        await listActions.deleteCard(listId, _id)(dispatch);
        dispatch(deleteCard(_id));
        await db.remove({ _id });
    },
    onTimerFinished:
        (_id: string, sessionId: string, spentTimeInHour: number) => async (dispatch: Dispatch) => {
            dispatch(addSession(_id, sessionId, spentTimeInHour));
            await db.update(
                { _id },
                {
                    $push: { sessionIds: sessionId },
                    $inc: { 'spentTimeInHour.actual': spentTimeInHour },
                }
            );
        },
    addCard:
        (_id: string, listId: string, title: string, content: string = '') =>
        async (dispatch: Dispatch) => {
            const now = +new Date();
            dispatch(addCard(_id, title, content, now));
            await listActions.addCardById(listId, _id)(dispatch);
            await db.insert({
                _id,
                title,
                content,
                sessionIds: [],
                spentTimeInHour: {
                    estimated: 0,
                    actual: 0,
                },
                createdTime: now,
                subTasks: [],
            } as Card);
        },
    addSubTask: (cardId: string, title: string) => async (dispatch: Dispatch) => {
        const subTask: SubTask = {
            title,
            completed: false,
            _id: shortid.generate(),
            createdTime: +new Date(),
        };
        dispatch(addSubTask(cardId, subTask));
        await db.update({ _id: cardId }, { $push: { subTasks: subTask } });
    },
    toggleSubTask: (cardId: string, subTaskId: string) => async (dispatch: Dispatch) => {
        dispatch(toggleSubTask(cardId, subTaskId));
        const card: Card = await db.findOne({ _id: cardId });
        if (card && card.subTasks) {
            const subTask = card.subTasks.find((st) => st._id === subTaskId);
            if (subTask) {
                await db.update(
                    { _id: cardId, 'subTasks._id': subTaskId },
                    { $set: { 'subTasks.$.completed': !subTask.completed } }
                );
            }
        }
    },
    deleteSubTask: (cardId: string, subTaskId: string) => async (dispatch: Dispatch) => {
        dispatch(deleteSubTask(cardId, subTaskId));
        await db.update({ _id: cardId }, { $pull: { subTasks: { _id: subTaskId } } });
    },
    updateSubTask:
        (cardId: string, subTaskId: string, title: string) => async (dispatch: Dispatch) => {
            dispatch(updateSubTask(cardId, subTaskId, title));
            await db.update(
                { _id: cardId, 'subTasks._id': subTaskId },
                { $set: { 'subTasks.$.title': title } }
            );
        },
};

export const cardReducer = createReducer<CardsState, any>({}, (handle) => [
    handle(
        addCard,
        (state, { payload: { _id, title = '', content = '', createdTime = +new Date() } }) => {
            return {
                ...state,
                [_id]: {
                    _id,
                    title,
                    content,
                    createdTime,
                    sessionIds: [],
                    spentTimeInHour: {
                        actual: 0,
                        estimated: 0,
                    },
                    subTasks: [],
                },
            };
        }
    ),

    handle(renameCard, (state, { payload: { _id, title } }) => {
        return {
            ...state,
            [_id]: {
                ...state[_id],
                title,
            },
        };
    }),

    handle(setContent, (state, { payload: { _id, content } }) => {
        return {
            ...state,
            [_id]: {
                ...state[_id],
                content,
            },
        };
    }),

    handle(setEstimatedTime, (state, { payload: { _id, estimatedTime } }) => {
        return {
            ...state,
            [_id]: {
                ...state[_id],
                spentTimeInHour: {
                    actual: state[_id].spentTimeInHour.actual,
                    estimated: estimatedTime,
                },
            },
        };
    }),

    handle(setActualTime, (state, { payload: { _id, actualTime } }) => {
        return {
            ...state,
            [_id]: {
                ...state[_id],
                spentTimeInHour: {
                    actual: actualTime,
                    estimated: state[_id].spentTimeInHour.estimated,
                },
            },
        };
    }),

    handle(deleteCard, (state, { payload: { _id } }) => {
        const { [_id]: deleted, ...rest } = state;
        return rest;
    }),

    handle(setCards, (state, { payload }) => payload),
    handle(addActualTime, (state, { payload: { _id, plus } }) => {
        return {
            ...state,
            [_id]: {
                ...state[_id],
                spentTimeInHour: {
                    ...state[_id].spentTimeInHour,
                    actual: state[_id].spentTimeInHour.actual + plus,
                },
            },
        };
    }),

    handle(addSession, (state, { payload: { _id, sessionId, spentTime } }) => {
        const card = state[_id];
        return {
            ...state,
            [_id]: {
                ...card,
                sessionIds: [...card.sessionIds, sessionId],
                spentTimeInHour: {
                    actual: card.spentTimeInHour.actual + spentTime,
                    estimated: card.spentTimeInHour.estimated,
                },
            },
        };
    }),

    handle(addSubTask, (state, { payload: { cardId, subTask } }) => {
        const card = state[cardId];
        return {
            ...state,
            [cardId]: {
                ...card,
                subTasks: [...(card.subTasks || []), subTask],
            },
        };
    }),

    handle(toggleSubTask, (state, { payload: { cardId, subTaskId } }) => {
        const card = state[cardId];
        if (!card.subTasks) return state;

        return {
            ...state,
            [cardId]: {
                ...card,
                subTasks: card.subTasks.map((st) =>
                    st._id === subTaskId ? { ...st, completed: !st.completed } : st
                ),
            },
        };
    }),

    handle(deleteSubTask, (state, { payload: { cardId, subTaskId } }) => {
        const card = state[cardId];
        if (!card.subTasks) return state;

        return {
            ...state,
            [cardId]: {
                ...card,
                subTasks: card.subTasks.filter((st) => st._id !== subTaskId),
            },
        };
    }),

    handle(updateSubTask, (state, { payload: { cardId, subTaskId, title } }) => {
        const card = state[cardId];
        if (!card.subTasks) return state;

        return {
            ...state,
            [cardId]: {
                ...card,
                subTasks: card.subTasks.map((st) => (st._id === subTaskId ? { ...st, title } : st)),
            },
        };
    }),
]);

export type CardActionTypes = { [key in keyof typeof actions]: typeof actions[key] };
