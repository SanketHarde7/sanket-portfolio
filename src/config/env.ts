
import "dotenv/config";
function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`missing enviorment variable ${name}`);

    }
    return value;
}

export const env = {
    port: Number(required("PORT")),
    db: {
        host: required("DB_HOST"),
        port: Number(required("DB_PORT")),
        user: required("DB_USER"),
        password: required("DB_PASSWORD"),
        name: required("DB_NAME"),
    },
};