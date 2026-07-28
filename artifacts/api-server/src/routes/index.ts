import { Router, type IRouter } from "express";
import healthRouter from "./health";
import importRouter from "./import";
import importConfirmRouter from "./import-confirm";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(importRouter);
router.use(importConfirmRouter);
router.use(reportsRouter);

export default router;
