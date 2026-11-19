import { z } from "zod";
import { HISTORY_RANGES } from "./domain";

export const historyRangeSchema = z.enum(HISTORY_RANGES).default("1y");
