import { sparkEmdash } from "spark-emdash/middleware";
import { sequence } from "astro:middleware";

export const onRequest = sequence(
  sparkEmdash()
);
