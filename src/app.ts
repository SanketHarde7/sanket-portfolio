import express from "express";
import userRoutes from "./modules/user/user.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import type { NextFunction, Request, Response } from "express";
const app =express();
app.use(express.json());
app.get("/health",(req,res)=>{
    res.json({status : "ok"});
});
app.use ("/users",userRoutes);
app.use("/conversations", chatRoutes);
app.use((req, res) => {
    res.status(404).json({ error: "not found" });
  });
  
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
  
    const status =
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      typeof err.status === "number"
        ? err.status
        : 500;
  
    if (status >= 400 && status < 500) {
      res.status(status).json({ error: "bad request" });
      return;
    }
  
    console.error("unhandled error:", err);
    res.status(500).json({ error: "server error" });
  });
export default app;