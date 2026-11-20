import { Router } from "express";
import { createUser, getUserById } from "./user.queries.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router = Router();

router.post("/", async (req, res) => {
  const username = req.body?.username;

  if (typeof username !== "string" || username.trim() === "") {
    res.status(400).json({ error: "username is required" });
    return;
  }

  try {
    const user = await createUser(username.trim());
    res.status(201).json(user);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "username already taken" });
      return;
    }
    throw err;
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!UUID_REGEX.test(id)) {
    res.status(400).json({ error: "invalid user id" });
    return;
  }

  const user = await getUserById(id);
  if (!user) {
    res.status(404).json({ error: "user not found" });
    return;
  }

  res.json(user);
});

export default router;