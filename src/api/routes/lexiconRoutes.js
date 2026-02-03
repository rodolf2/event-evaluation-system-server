const express = require("express");
const router = express.Router();
const lexiconController = require("../controllers/lexiconController");
const { requireRole } = require("../../middlewares/auth");

// All lexicon routes are protected and restricted to MIS admins and PSAS Staff (for PSAS Head dashboard)
router.use(requireRole(["mis", "psas"]));

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
