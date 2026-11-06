module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ openrouterKey: process.env.OPENROUTER_API_KEY || '' });
};
