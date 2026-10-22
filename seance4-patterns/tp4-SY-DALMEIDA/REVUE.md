# REVUE CROISÉE — TP 4 · parcours Dev

- Code relu : dossier `seance4-patterns/tp4-SY-DALMEIDA/` (SY EL Housseine · D'ALMEIDA Fadel)
- Relecteurs : SY EL Housseine · D'ALMEIDA Fadel (relecture faite sur notre propre code)

## Points vérifiés

- [x] `channels.js` est resté intact après l'ajout de Slack : `slack.js` importe `Channel` et `registerChannel` et enregistre `SlackChannel` sans rien modifier dans `channels.js` (test « Factory (OCP) » vert).
- [x] La validation se fait uniquement dans `build()` : les méthodes `to`, `template`, `with` et `priority` ne font que stocker une valeur et renvoyer `this`.
- [x] Les décorateurs ont la même interface `getQuote(parcel)` et sont composables : `CachedQuote(RetryQuote(DhlAdapter(...)))` fonctionne (test de composition vert).
- [x] La façade reste robuste en cas de panne d'un transporteur : `Promise.allSettled` écarte les transporteurs en échec, et l'erreur « Aucun transporteur disponible » est levée si aucun ne répond.

## Remarque 1 · `RetryQuote` réessaie aussi les erreurs qui ne sont pas des pannes

**Constat :** `RetryQuote` relance l'appel pour toute erreur, sans distinguer le type. Si le code postal est invalide, `ColissimoApi` lève « Code postal invalide » : l'erreur est certaine et se reproduira identiquement, mais le décorateur refait quand même 3 tentatives. De plus, les tentatives s'enchaînent sans aucun délai.

**Pourquoi c'est un problème :** on fait des appels inutiles sur une erreur de saisie, et contre un vrai 503 on martèle le service sans lui laisser le temps de revenir, ce qui peut aggraver la panne.

**Suggestion :** accepter un paramètre `shouldRetry(error)` (par défaut, réessayer seulement les erreurs de type indisponibilité comme le 503) et ajouter un délai croissant entre deux tentatives (backoff), avec une fonction `sleep` injectable pour que les tests restent rapides.

## Remarque 2 · `CachedQuote` ne protège pas contre les appels simultanés et grossit sans limite

**Constat :** `CachedQuote` enregistre le devis seulement après le `await`. Si deux appels identiques arrivent avant la fin du premier, les deux ne trouvent rien en cache et appellent tous les deux le transporteur. Par ailleurs, les entrées expirées ne sont jamais supprimées : la `Map` grossit avec chaque couple poids|code postal.

**Pourquoi c'est un problème :** on perd l'intérêt du cache pile quand la charge est forte, et la mémoire augmente indéfiniment sur un service qui tourne longtemps.

**Suggestion :** mettre en cache la promesse plutôt que la valeur (et la retirer du cache si elle est rejetée, pour ne jamais mémoriser une panne), et purger les entrées expirées ou limiter le nombre d'entrées.