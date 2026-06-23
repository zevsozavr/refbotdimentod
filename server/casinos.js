const casinos = {
  topmatch: {
    id: 'topmatch',
    name_uk: 'TopMatch',
    name_ru: 'TopMatch',
    referral_link: process.env.REFERRAL_LINK_TOPMATCH,
    photo: 'topmatch.jpg',
    level_column: 'level_topmatch',
    casino_id_column: 'casino_id_topmatch',
  },
  tonplay: {
    id: 'tonplay',
    name_uk: 'TonPlay',
    name_ru: 'TonPlay',
    referral_link: process.env.REFERRAL_LINK_TONPLAY || process.env.REFERRAL_LINK,
    photo: 'tonplay.jpg',
    level_column: 'level_tonplay',
    casino_id_column: 'casino_id_tonplay',
  },
};
module.exports = casinos;