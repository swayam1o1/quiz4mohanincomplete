module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('🟢 User connected:', socket.id);

    socket.on('join-quiz', (code) => {
      socket.join(code);
      console.log(`Socket ${socket.id} joined quiz room: ${code}`);
    });

    socket.on('disconnect', () => {
      console.log('🔴 User disconnected:', socket.id);
    });
  });
};
