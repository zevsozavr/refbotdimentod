const casinos = {
  topmatch: {
    id: 'topmatch',
    name_uk: 'TopMatch',
    name_ru: 'TopMatch',
    referral_link: process.env.REFERRAL_LINK_TOPMATCH,
    photo: 'topmatch.jpg',
    level_column: 'level_topmatch',
  },
  tonplay: {
    id: 'tonplay',
    name_uk: 'TonPlay',
    name_ru: 'TonPlay',
    referral_link: process.env.REFERRAL_LINK_TONPLAY,
    photo: 'tonplay.jpg',
    level_column: 'level_tonplay',
  },
};
module.exports = casinos;