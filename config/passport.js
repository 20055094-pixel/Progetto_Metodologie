const passport = require(`passport`);
const LocalStrategy = require(`passport-local`).Strategy;
const GoogleStrategy = require(`passport-google-oauth20`).Strategy;
const db = require(`../database/db`);

module.exports = function(passport) {
    console.log(`Configurazione Passport...`);

    // Serializzazione utente
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserializzazione utente
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await db(`users`).where(`id`, id).first();
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });

    // Strategia locale (email/password)
    passport.use(new LocalStrategy({
        usernameField: `email`,
        passwordField: `password`
    }, async (email, password, done) => {
        try {
            console.log(`Login attempt:`, email);
            const user = await db(`users`).where({ email, password }).first();
            
            if (!user) {
                return done(null, false, { message: `Credenziali non valide` });
            }
            
            console.log(`Login riuscito:`, user.email, `Role:`, user.role);
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }));

    // Strategia Google OAuth
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await db(`users`).where(`google_id`, profile.id).first();
                
                if (user) {
                    return done(null, user);
                }
                
                user = await db(`users`).where(`email`, profile.emails[0].value).first();
                
                if (user) {
                    await db(`users`).where(`id`, user.id).update({ google_id: profile.id });
                    return done(null, user);
                }
                
                const [newUserId] = await db(`users`).insert({
                    google_id: profile.id,
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    role: `user`
                });
                
                const newUser = await db(`users`).where(`id`, newUserId).first();
                return done(null, newUser);
            } catch (error) {
                return done(error);
            }
        }));
    }

    console.log(`Passport configurato!`);
};
