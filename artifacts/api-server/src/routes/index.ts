import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactsRouter from "./contacts";
import conversationsRouter from "./conversations";
import inboxRouter from "./inbox";
import respostasRapidasRouter from "./respostas-rapidas";
import pipelineRouter from "./pipeline";
import tarefasRouter from "./tarefas";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactsRouter);
router.use(conversationsRouter);
router.use(inboxRouter);
router.use(respostasRapidasRouter);
router.use("/pipeline", pipelineRouter);
router.use("/tarefas", tarefasRouter);

export default router;
