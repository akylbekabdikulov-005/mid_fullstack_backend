const mongoose = require('mongoose');
const Portfolio = require('../models/Portfolio');
const Stock = require('../models/Stock');
const User = require('../models/User');

async function getPortfolio(req, res) {
  const userId = req.user.id;
  const user = await User.findById(userId).lean();
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const holdings = await Portfolio.find({ userId }).lean();
  const tickers = holdings.map((item) => item.ticker);
  const stocks = await Stock.find({ ticker: { $in: tickers } }).lean();
  const prices = stocks.reduce((map, stock) => {
    map[stock.ticker] = stock.price;
    return map;
  }, {});

  const enrichedHoldings = holdings.map((item) => ({
    ticker: item.ticker,
    sharesOwned: item.sharesOwned,
    currentPrice: prices[item.ticker] ?? 0
  }));

  return res.status(200).json({
    walletBalance: user.walletBalance,
    holdings: enrichedHoldings
  });
}

async function buyShares(req, res) {
  const userId = req.user.id;
  const { ticker, quantity } = req.body;

  if (!ticker || !quantity || quantity <= 0 || !Number.isInteger(quantity)) {
    return res.status(400).json({ message: 'Ticker and positive quantity are required' });
  }

  const stock = await Stock.findOne({ ticker: ticker.trim().toUpperCase() });
  if (!stock) {
    return res.status(404).json({ message: 'Stock not found' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const cost = stock.price * quantity;
  if (user.walletBalance < cost) {
    return res.status(400).json({ message: 'Insufficient wallet balance' });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      user.walletBalance -= cost;
      await user.save({ session });

      await Portfolio.findOneAndUpdate(
        { userId, ticker: stock.ticker },
        { $inc: { sharesOwned: quantity } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ message: 'Trade failed', error: error.message });
  } finally {
    session.endSession();
  }

  const portfolio = await Portfolio.findOne({ userId, ticker: stock.ticker }).lean();

  return res.status(200).json({
    walletBalance: user.walletBalance,
    ticker: stock.ticker,
    sharesOwned: portfolio.sharesOwned
  });
}

module.exports = {
  getPortfolio,
  buyShares
};
