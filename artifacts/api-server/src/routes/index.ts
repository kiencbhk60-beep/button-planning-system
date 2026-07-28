import { Router, type IRouter } from "express";
import healthRouter from "./health";
import importRouter from "./import";

const router: IRouter = Router();

router.use(healthRouter);
router.use(importRouter);

export default router;
