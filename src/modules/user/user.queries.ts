
import { pool } from "../../db/pool.js";
export type User = {
    id: string;
    username: string;
    created_at: Date;
};

export async function createUser(username:string) :Promise<User>{
    const result=await pool.query<User>(
        "INSERT INTO users (username) VALUES ($1) RETURNING id,username,created_at",
        [username]
    );
    return result.rows[0];
}
export async function getUserById(id : string):Promise <User | null>
{
    const result = await pool.query<User>
    ( " SELECT id ,username ,created_at FROM users WHERE id =$1 ",[id]);
    return result.rows [0] ?? null ;
}