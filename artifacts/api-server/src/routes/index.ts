import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactsRouter from "./contacts";
import conversationsRouter from "./conversations";
import inboxRouter from "./inbox";
import respostasRapidasRouter from "./respostas-rapidas";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactsRouter);
router.use(conversationsRouter);
router.use(inboxRouter);
router.use(respostasRapidasRouter);

export default router;
