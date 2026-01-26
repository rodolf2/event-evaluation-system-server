const express = require("express");
const router = express.Router();
const lexiconController = require("../controllers/lexiconController");
const { requireRole } = require("../../middlewares/auth");

// All lexicon routes are protected and restricted to MIS admins
router.use(requireRole(["mis"]));

router
  .route("/")
  .get(lexiconController.getLexicon)
  .post(lexiconController.addWord);

router.post("/bulk", lexiconController.bulkAdd);

router
  .route("/:id")
  .put(lexiconController.updateWord)
  .delete(lexiconController.deleteWord);

module.exports = router;
