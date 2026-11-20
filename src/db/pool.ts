
import pg from "pg";
import {env} from "../config/env.js";
export const pool = new pg.Pool({
    host :env.db.host,
    port : env.db.port,
    user: env.db.user,
  password: env.db.password,
  database: env.db.name,
});