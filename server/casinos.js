const casinos = {
  topmatch: {
    id: 'topmatch',
    name_uk: 'TopMatch',
    name_ru: 'TopMatch',
    referral_link: process.env.REFERRAL_LINK_TOPMATCH,
    photo: 'topmatch.png',
    level_column: 'level_topmatch',
    casino_id_column: 'casino_id_topmatch',
  },
  betline: {
    id: 'betline',
    name_uk: 'Betline',
    name_ru: 'Betline',
    referral_link: process.env.REFERRAL_LINK_BETLINE || process.env.REFERRAL_LINK_TONPLAY || process.env.REFERRAL_LINK,
    photo: 'betline.jpg',
    level_column: 'level_betline',
    casino_id_column: 'casino_id_betline',
  },
};
module.exports = casinos;