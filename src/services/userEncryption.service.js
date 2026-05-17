const { encrypt, decrypt, hashForLookup } = require("../../utils/encryption");

exports.encryptUserFields = (data) => {
  const result = { ...data };

  if (data.email) {
    result.email      = encrypt(data.email.toLowerCase().trim());
    result.email_hash = hashForLookup(data.email);
  }
  if (data.firstname) {
    result.firstname      = encrypt(data.firstname.trim());
    result.firstname_hash = hashForLookup(data.firstname);
  }
  if (data.lastname) {
    result.lastname      = encrypt(data.lastname.trim());
    result.lastname_hash = hashForLookup(data.lastname);
  }
  if (data.phone) {
    result.phone = encrypt(data.phone.trim());
  }

  return result;
};


exports.decryptUserFields = (user) => {
  if (!user) return null;

  return {
    ...user,
    email:     decrypt(user.email)     || user.email,
    firstname: decrypt(user.firstname) || user.firstname,
    lastname:  decrypt(user.lastname)  || user.lastname,
    phone:     decrypt(user.phone)     || user.phone,
  };
};


exports.decryptUserList = (users) => {
  return users.map(exports.decryptUserFields);
};