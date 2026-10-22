# PATTERNS — TP 4 · binôme SY EL Housseine · D'ALMEIDA Fadel · parcours Dev

## Tableau des patterns

| Pattern | Problème résolu dans ShopLite | Alternative écartée | Pourquoi écartée |
|---|---|---|---|
| Factory Method + registre | ShopLite prévient ses clients par e-mail, SMS et push, et l'équipe logistique veut Slack. `createChannel(type)` renvoie le bon canal à partir de son nom, et `registerChannel` permet d'ajouter Slack depuis `slack.js` sans toucher à `channels.js`. | Un `switch` sur le type à l'intérieur de `createChannel`. | Chaque nouveau canal obligerait à modifier `channels.js` : on viole le principe ouvert/fermé (OCP) et on risque de casser les canaux existants. |
| Builder | Un message doit être construit à partir d'un destinataire, d'un gabarit `{{nom}}`, de variables et d'une priorité facultative. Le Builder assemble ces éléments pas à pas, valide tout une seule fois dans `build()` et renvoie un objet gelé. | Un constructeur avec plusieurs paramètres positionnels, ou un objet littéral écrit à la main. | Ordre des paramètres facile à confondre, validation dispersée (ou absente), et message modifiable après sa création. |
| Adapter | Colissimo est synchrone, en grammes et en centimes ; DHL est asynchrone, en kilos et renvoie le montant en texte. `ColissimoAdapter` et `DhlAdapter` exposent le même contrat `getQuote({ weightKg, zip })` → `{ carrier, price, days }`. | Des `if (carrier === ...)` dans le code métier, ou modifier les API des transporteurs. | Le code métier connaîtrait tous les formats et grossirait à chaque transporteur ajouté ; les API nous sont fournies et ne sont pas modifiables. |
| Decorator (RetryQuote, CachedQuote) | DHL tombe parfois en panne (503) et chaque appel coûte du temps. `RetryQuote` réessaie, `CachedQuote` évite de réinterroger le transporteur pendant le TTL. Les deux gardent l'interface `getQuote(parcel)` et se composent librement. | Héritage (`CachedRetryDhlAdapter`, `RetryColissimoAdapter`...) ou code de cache et de retry recopié dans chaque adaptateur. | Explosion du nombre de sous-classes, code dupliqué et combinaisons figées. Avec les décorateurs, on choisit la composition au moment de l'assemblage dans `main.js`. |
| Facade | Le reste de l'application ne veut qu'une réponse : « quel est le meilleur tarif ? ». `ShippingService.bestQuote()` interroge tous les transporteurs en parallèle, ignore ceux en panne (`Promise.allSettled`), choisit le moins cher puis le plus rapide. | Laisser chaque appelant interroger lui-même les transporteurs et comparer les devis. | Logique de tri et de gestion des pannes dupliquée partout, et chaque appelant serait couplé aux transporteurs. |

## Question à justifier : pourquoi le cache enveloppe-t-il le retry (et pas l'inverse) ?

La composition retenue est `new CachedQuote(new RetryQuote(adapter))`.

- **Cache en extérieur** : si le devis est déjà en cache, on répond tout de suite, sans appeler le transporteur ni déclencher de nouvelle tentative.
- **Seul un succès est mis en cache** : le retry absorbe les pannes passagères, donc le cache ne reçoit que le résultat final réussi. Une erreur lancée par le retry (après tous les échecs) traverse le cache sans y être enregistrée.
- **Le risque de l'ordre inverse** : avec `Retry(Cache(adapter))`, une réponse mauvaise ou une panne pourrait être figée par le cache pendant tout le TTL, et le retry ne ferait que relancer des appels vers le cache sans protéger le transporteur.

En résumé : le retry rend l'appel fiable, puis le cache mémorise un résultat fiable.