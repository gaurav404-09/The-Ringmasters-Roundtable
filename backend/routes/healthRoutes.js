import express from 'express';

const createHealthRoutes = (io) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', websocket: io.engine.clientsCount });
  });

  return router;
};

export default createHealthRoutes;
