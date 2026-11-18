// DRAFT: requires native-speaker review; legal labels are not legal documents.
import type { Messages } from './messages.ts';
export const messages = {
  photoUi: {
    JP: 'Rues traditionnelles de Kyoto, au Japon',
    IT: 'Maisons colorées sur la côte des Cinque Terre, en Italie',
    US: 'La statue de la Liberté à New York, aux États-Unis',
    TR: 'Montgolfières au-dessus des formations rocheuses de Cappadoce, en Turquie',
    FR: 'La tour Eiffel à Paris, en France',
    CH: 'Montagnes enneigées et lac gelé en Engadine, en Suisse',
    TH: 'Wat Arun au bord du fleuve à Bangkok, en Thaïlande',
    AU: 'L’opéra de Sydney dans la baie de Sydney, en Australie',
    BR: 'Le Christ Rédempteur au-dessus de Rio de Janeiro, au Brésil',
    ZA: 'La montagne de la Table au Cap, en Afrique du Sud',
    AE: 'Le Burj Khalifa à Dubaï, aux Émirats arabes unis',
    EG: 'Une pyramide dans le désert de Gizeh, en Égypte',
  },
  transactionUi: {
    purchaseContract: 'Votre contrat d’achat',
    yourOrder: 'Votre commande',
    legalAcceptanceTimestamp: 'Horodatage de l’acceptation juridique',
    taxNotRecorded: 'La taxe n’a pas été enregistrée séparément pour cette commande.',
    wifiStep: 'Connectez votre téléphone au Wi-Fi.',
    title: 'Alozuri — Confirmation de commande et contrat',
    confirmedPurchase: 'Votre achat confirmé',
    orderPlaced: 'Commande passée le',
    paidAt: 'Paiement confirmé le',
    timestampMissing: 'Horodatage absent de cette réponse de commande',
    testPayment: 'Paiement test réussi — aucun débit réel ni eSIM',
    customerName: 'Nom du client',
    purchasedPlans: 'Forfaits achetés',
    planReference: 'Référence du forfait',
    includedCountries: 'Pays inclus',
    activationRule: 'Règle d’activation',
    restrictions: 'Restrictions et usage raisonnable',
    noRestrictions: 'Aucune restriction supplémentaire enregistrée.',
    supplierConditions: 'Conditions du fournisseur',
    quantity: 'Quantité',
    unitPrice: 'Prix unitaire',
    lineTotal: 'Total de la ligne',
    paymentTotal: 'Total du paiement',
    tax: 'Taxe facturée séparément',
    taxMissing: 'Non enregistrée séparément',
    taxDoc:
      'Aucun taux de taxe ni immatriculation TVA n’est enregistré pour cette commande. Ce document est une confirmation de commande et un contrat.',
    legalAcceptance: 'Acceptation juridique enregistrée',
    acceptedAt: 'Accepté le',
    termsVersion: 'Version des Conditions générales',
    refundVersion: 'Version de la Politique de remboursement et d’annulation',
    effectiveDate: 'Date d’entrée en vigueur',
    totalPaid: 'Total payé',
    orderReference: 'Référence de commande',
    purchaseDate: 'Date et heure d’achat',
    contractDate: 'Date et heure du contrat',
    seller: 'Vendeur',
    companyNumber: 'Numéro d’immatriculation',
    contact: 'Coordonnées',
    contractIncludes:
      'Les détails, pays, validité, règles d’activation et restrictions indiqués dans Votre commande ci-dessus font partie du contrat d’achat.',
    thanks:
      'Merci d’avoir choisi Alozuri. Retrouvez votre eSIM sur votre page de commande sécurisée.',
    ready:
      'Votre eSIM est prête. Ouvrez la page sécurisée pour voir le QR code et les données d’installation manuelle.',
    pending:
      'Votre commande est en cours de traitement. La page sécurisée indique son état et affichera QR code, installation manuelle et activation après préparation. Revenez à tout moment avec le même lien.',
    activationNote:
      'Avant l’installation, vérifiez ci-dessous la règle d’activation de chaque forfait. Certains commencent à l’installation, à la première connexion réseau ou à l’achat ; suivez la règle enregistrée pour votre achat.',
    important:
      'Votre appareil doit accepter l’eSIM et être déverrouillé. Protégez QR code, détails d’installation et lien privé. Le récapitulatif affiche les règles enregistrées d’activation, validité, données et usage raisonnable. Aide : support@alozuri.com.',
    access: 'Accéder à votre eSIM',
    viewInstall: 'Voir et installer votre eSIM',
    installReady: 'Installez quand vous êtes prêt',
    openOrder: 'Ouvrez votre page de commande Alozuri sécurisée.',
    scan: 'Scannez le QR code eSIM ou suivez l’installation manuelle.',
    enable: 'Activez votre eSIM Alozuri dans les réglages mobiles.',
    roaming: 'Activez l’itinérance des données de l’eSIM Alozuri si nécessaire.',
    connect: 'Connectez-vous à un réseau compatible selon les conditions d’activation du forfait.',
    importantTitle: 'Informations importantes',
    originalRetail: 'Prix initial',
    promotion: 'Code promotionnel {code} ({percent}%)',
    taxPresent:
      'Taxe facturée séparément : {amount}. Aucun taux de taxe ni immatriculation TVA n’est enregistré pour cette commande.',
    paymentStatus: 'État du paiement',
  },
  legalUi: {
    about: 'À propos d’Alozuri',
    eyebrow: 'ALOZURI · INFORMATIONS JURIDIQUES ET CLIENTS',
    effective: 'En vigueur le {date} · Version {version}',
    version: 'Version n° {version}',
    permanent: 'Lien permanent vers cette version',
    contents: 'Sur cette page',
    scroll: 'Balayez ou faites défiler pour voir toutes les colonnes.',
    related: 'Politiques associées',
    archived: 'Version archivée de la politique',
    previous: 'Version précédente : {title}',
    request: 'Pour demander une copie de cette version, contactez {support}.',
    orderCopies:
      'Les conditions de votre achat restent disponibles dans la confirmation de commande et les documents téléchargeables de votre page privée.',
    unchanged: 'Cette mise à jour ne modifie pas les conditions déjà liées à votre achat.',
    current: 'Lire la version actuelle : {title}',
    notice:
      'En passant commande, vous acceptez nos Conditions générales et reconnaissez avoir pris connaissance de notre Politique de remboursement, de notre Politique de confidentialité et des Exigences de compatibilité eSIM.',
    documentHeader: 'Version {version} — en vigueur le {date}',
  },
  seoUi: {
    homeTitle: 'eSIM Alozuri pour les voyages internationaux',
    homeDescription:
      'Comparez les données eSIM prépayées pour un ou plusieurs pays. Vérifiez couverture réelle, volume, validité et activation avant de payer.',
    destTitle: 'Destinations eSIM de voyage',
    destDescription:
      'Découvrez les destinations eSIM, comparez les forfaits locaux et multi-pays et vérifiez couverture, volume, validité et activation.',
    helpTitle: 'Aide et installation eSIM',
    helpDescription:
      'Obtenez de l’aide pour la compatibilité, l’installation, les règles d’activation et le contact avec Alozuri.',
    planDescription:
      '{allowance} de données de voyage pour {days}. Vérifiez couverture confirmée, activation et conditions d’usage raisonnable avant l’achat.',
    planTitle: 'Détails du forfait',
    planUnavailable:
      'Vérifiez la disponibilité actuelle des eSIM et les informations confirmées du forfait.',
    tagline: 'Alozuri — Une eSIM. Toutes vos étapes.',
  },
  partnersUi: {
    metaTitle: 'Programme d’affiliation Alozuri — Devenez partenaire',
    metaDescription:
      'Rejoignez Alozuri : 10% de commission sur les recommandations eSIM éligibles, suivi de 30 jours et tableau de bord dédié.',
    eyebrow: 'PARTENAIRES ALOZURI',
    title: 'Devenez partenaire d’Alozuri',
    intro:
      'Aidez les voyageurs à rester connectés partout et gagnez des commissions en recommandant les forfaits eSIM Alozuri.',
    apply: 'Devenir partenaire',
    free: 'Inscription gratuite. Candidatures soumises à approbation.',
    benefitsTitle: 'Un partenariat qui vous récompense.',
    commissionTitle: '10% de commission',
    commission: 'Gagnez 10% sur chaque achat eSIM éligible attribué à votre recommandation.',
    trackingTitle: 'Suivi de 30 jours',
    tracking:
      'Recevez une attribution pour les achats éligibles effectués dans les 30 jours suivant la recommandation.',
    dashboardTitle: 'Tableau de bord dédié',
    dashboard: 'Consultez vos recommandations, ventes et commissions dans votre espace affilié.',
    applyStep: 'Postulez',
    applyText: 'Envoyez votre candidature au programme d’affiliation Alozuri.',
    shareStep: 'Partagez',
    shareText:
      'Après validation, recevez votre lien personnel et présentez Alozuri sur vos canaux.',
    earnStep: 'Gagnez',
    earnText:
      'Touchez des commissions sur les achats éligibles et suivez vos résultats dans votre espace affilié.',
    audienceTitle: 'Qui peut nous rejoindre ?',
    audienceIntro:
      'Créateurs de contenus ou professionnels du voyage, Alozuri vous permet de gagner simplement en recommandant des forfaits eSIM internationaux.',
    youtube: 'YouTubeurs voyage',
    creators: 'Créateurs de contenu et influenceurs',
    blogs: 'Blogueurs et éditeurs voyage',
    agencies: 'Agences de voyages',
    communities: 'Communautés de voyageurs',
    termsEyebrow: 'CLAIR DÈS LE DÉPART',
    paymentsTitle: 'Commissions et paiements',
    paymentsIntro: 'Un programme simple aux critères d’éligibilité clairs.',
    termCommission: '10% de commission sur les achats éligibles.',
    termWindow: 'Fenêtre d’attribution de 30 jours.',
    termAttribution: 'Attribution au dernier clic.',
    termPending: 'Les commissions restent en attente pendant 30 jours après l’achat.',
    termMinimum: 'Solde minimal de versement : équivalent de 50 USD.',
    termPaid: 'Les commissions approuvées sont versées chaque mois par les moyens pris en charge.',
    termExcluded:
      'Les transactions remboursées, annulées, frauduleuses ou contestées par rétrofacturation sont exclues.',
    faqIntro: 'Quelques informations avant de postuler.',
    q1: 'L’inscription est-elle gratuite ?',
    a1: 'Oui. La candidature et la participation sont gratuites.',
    q2: 'Qui peut devenir partenaire ?',
    a2: 'Créateurs voyage, blogueurs, éditeurs et entreprises pertinentes peuvent postuler. Toutes les candidatures sont soumises à approbation.',
    q3: 'Combien puis-je gagner ?',
    a3: 'Les affiliés gagnent 10% sur les achats éligibles attribués à leurs recommandations.',
    q4: 'Comment les recommandations sont-elles suivies ?',
    a4: 'Pendant 30 jours au maximum, sous réserve du consentement applicable et de la disponibilité du suivi.',
    q5: 'Quand serai-je payé ?',
    a5: 'Les commissions approuvées sont versées mensuellement lorsque le solde payable atteint l’équivalent de 50 USD.',
    q6: 'Où consulter mes gains ?',
    a6: 'Les partenaires approuvés accèdent à leur tableau de bord d’affiliation Endorsely.',
    finalTitle: 'Grandissons ensemble.',
    finalText:
      'Rejoignez le programme Alozuri et gagnez en aidant les voyageurs à rester connectés.',
    finalApply: 'Postuler pour devenir partenaire',
    newTab: 's’ouvre dans un nouvel onglet',
  },
  regionUi: {
    title: 'eSIM de voyage pour plusieurs pays d’Europe',
    description:
      'Comparez les eSIM pour un voyage en Europe. Vérifiez pays, prix actuels, validité et activation ; la couverture régionale varie.',
    eyebrow: 'DONNÉES POUR PLUSIEURS PAYS',
    heading: 'Des eSIM Europe adaptées à votre itinéraire',
    intro:
      'Vous visitez plusieurs pays européens depuis les États-Unis ou ailleurs ? Comparez le forfait à vos étapes réelles. Europe est un nom régional, pas la garantie que tous les pays sont inclus.',
    example:
      'Les exemples ci-dessous couvrent {countries}. Ouvrez les listes de pays pour voir la couverture ou modifiez l’itinéraire. Aucun forfait n’est présenté comme couvrant toute l’Europe.',
    tip1: 'Ajoutez chaque pays visité, y compris les escales où vous aurez besoin de données.',
    tip2: 'Ne supposez pas que le Royaume-Uni, la Suisse ou la Turquie sont inclus dans un forfait nommé Europe.',
    tip3: 'Pour comparer une eSIM Europe de 10 GB, choisissez ce volume et comparez validité et couverture complète. Vérifiez les conditions de partage de connexion si nécessaire.',
    question1: 'Une eSIM peut-elle couvrir plusieurs pays européens ?',
    answer1:
      'Oui, si sa couverture vérifiée inclut chaque pays du voyage. Le planificateur exige tous les pays sélectionnés ; un forfait local pour une seule étape n’est pas un résultat complet.',
    question2: 'Faut-il installer une eSIM différente dans chaque pays ?',
    answer2:
      'Un profil régional peut couvrir plusieurs pays selon ses conditions de couverture et d’activation. Consultez le forfait sans supposer le même opérateur ou débit partout.',
    oneCountry: 'Vous visitez un seul pays ? Comparez {gb} ou {destinations}.',
    adviceTitle: 'Préparez vos données mobiles avant le départ',
    questions: 'Questions courantes',
    adviceLinks:
      'Vérifiez la {compatibility}, lisez {installation} ou la {refunds}. L’installation et l’activation peuvent modifier les possibilités d’annulation ; la politique explique les exceptions et droits des consommateurs.',
    compatibility: 'compatibilité de l’appareil',
    installation: 'quand installer votre eSIM',
    notFound: 'Destination introuvable',
    genericTitle: '{country} : eSIM de voyage',
    genericDescription:
      'Comparez les données, volumes, validités et règles d’activation pour {country}. Trouvez une couverture locale ou préparez plusieurs étapes.',
  },
  destinationCopy: {
    USTitle: 'eSIM de voyage aux États-Unis, depuis le Royaume-Uni et ailleurs',
    USDescription:
      'Comparez les forfaits eSIM pour les États-Unis : données, validité, prix actuels et activation. Vérifiez la couverture pour un séjour ou un itinéraire à étapes.',
    USIntro:
      'Vous partez du Royaume-Uni aux États-Unis ? Comparez les données prépayées pour les cartes, les messages et les réservations sans supposer que votre forfait habituel couvre l’itinérance. Choisissez un forfait américain ou vérifiez chaque étape de votre voyage.',
    USTip1:
      'Choisissez une validité couvrant l’arrivée et le départ, puis vérifiez son point de départ.',
    USTip2:
      'Un forfait américain n’inclut pas automatiquement le Canada ou le Mexique. Ajoutez ces étapes au planificateur si nécessaire.',
    USTip3:
      'Pour comparer 10 GB, utilisez le filtre de volume et comparez la validité et les conditions de données en plus du prix.',
    USQuestion1: 'Une eSIM américaine fonctionne-t-elle sur mon téléphone britannique ?',
    USAnswer1:
      'Votre modèle exact doit être compatible eSIM et déverrouillé par l’opérateur. Vérifiez auprès du fabricant et de l’opérateur avant l’achat ; le pays d’achat ne garantit pas la compatibilité.',
    USQuestion2: 'Une eSIM américaine inclut-elle un numéro américain ?',
    USAnswer2:
      'Les forfaits affichés fournissent des données mobiles. Ne supposez pas qu’un numéro local, les appels classiques ou les SMS sont inclus. Les appels et messages par internet consomment vos données.',
    GBTitle: 'eSIM pour les touristes au Royaume-Uni',
    GBDescription:
      'Comparez les données eSIM prépayées pour le Royaume-Uni, leur validité et les prix actuels. Vérifiez la compatibilité, les réseaux et l’activation.',
    GBIntro:
      'Vous visitez le Royaume-Uni depuis les États-Unis ou un autre pays ? Comparez les données pour vous orienter, gérer vos réservations et rester en contact. Vérifiez que votre téléphone est déverrouillé avant de payer.',
    GBTip1:
      'Si votre téléphone américain est financé ou verrouillé par un opérateur, renseignez-vous sur son déverrouillage avant le départ.',
    GBTip2:
      'Vous poursuivez en Europe ? Un forfait limité au Royaume-Uni ne couvre pas automatiquement le pays suivant ; comparez un itinéraire à plusieurs pays.',
    GBTip3:
      'Vérifiez la liste des pays de chaque forfait sans supposer que les îles ou territoires voisins sont inclus.',
    GBQuestion1: 'Les Américains peuvent-ils acheter une eSIM pour le Royaume-Uni ?',
    GBAnswer1:
      'Vous pouvez comparer et acheter sans créer de compte. Votre téléphone doit accepter le profil eSIM fourni et être déverrouillé ; votre nationalité ne détermine pas sa compatibilité.',
    GBQuestion2: 'Le Royaume-Uni est-il inclus dans une eSIM Europe ?',
    GBAnswer2:
      'Uniquement si le forfait concerné mentionne le Royaume-Uni. Un nom régional ne prouve pas la couverture ; vérifiez les pays inclus avant l’achat.',
    JPTitle: 'Forfaits eSIM de voyage au Japon',
    JPDescription:
      'Comparez les données, la validité, les prix actuels et les règles d’activation des eSIM pour le Japon. Vérifiez les réseaux et la compatibilité.',
    JPIntro:
      'Vous préparez un voyage au Japon ? Prévoyez les données pour vous orienter, traduire, échanger des messages et consulter vos réservations. Comparez les volumes fixes et quotidiens et vérifiez les conditions après épuisement du quota journalier.',
    JPTip1:
      'Téléchargez les cartes et les gros packs de langues en Wi-Fi avant le départ pour réduire l’utilisation des données mobiles.',
    JPTip2:
      'Ne supposez pas que chaque forfait commence à l’arrivée. Lisez la règle d’activation avant l’installation.',
    JPTip3:
      'Pour un voyage en Asie à plusieurs étapes, ajoutez chaque destination plutôt que de supposer que le forfait japonais couvre d’autres pays.',
    JPQuestion1: 'Puis-je installer une eSIM japonaise avant le vol ?',
    JPAnswer1:
      'Cela dépend de la règle d’activation. Certains profils commencent leur validité dès l’installation ; vérifiez le forfait acheté avant de scanner le QR code.',
    JPQuestion2: 'Quels réseaux japonais puis-je utiliser ?',
    JPAnswer2:
      'Consultez les réseaux indiqués pour le forfait concerné. Si le fournisseur n’a pas transmis cette information, Alozuri ne promet ni opérateur ni débit précis.',
    THTitle: 'Forfaits eSIM pour les touristes en Thaïlande',
    THDescription:
      'Comparez les données eSIM pour la Thaïlande, leur validité et les prix actuels. Consultez les réseaux, l’activation et les limites quotidiennes.',
    THIntro:
      'Choisissez vos données en Thaïlande selon la durée du séjour et vos usages. Cartes, transferts, messages et vidéo n’utilisent pas le même volume ; comparez ensemble données et validité.',
    THTip1:
      'Pour un séjour de 7 jours, vérifiez si la validité commence à l’achat, à l’installation ou à la première connexion à un réseau compatible.',
    THTip2:
      'Un forfait quotidien peut réduire le débit ou couper les données une fois le quota atteint ; lisez sa politique.',
    THTip3:
      'Si vous visitez un autre pays, ajoutez-le au planificateur pour exiger une couverture à chaque étape.',
    THQuestion1: 'Une eSIM touristique équivaut-elle à une SIM locale avec appels ?',
    THAnswer1:
      'Les forfaits Alozuri affichés sont réservés aux données. Ne supposez pas qu’ils incluent un numéro local ou des SMS.',
    THQuestion2: 'Illimité signifie-t-il sans restrictions ?',
    THAnswer2:
      'Non. Lorsqu’un forfait porte cette mention, lisez les règles d’usage raisonnable et les limites de débit du fournisseur. Un volume fixe ou quotidien peut être plus simple à comparer.',
    TRTitle: 'Forfaits eSIM de voyage en Turquie',
    TRDescription:
      'Comparez les forfaits eSIM pour la Turquie et les prix actuels pour les voyageurs britanniques et les autres visiteurs. Vérifiez couverture, validité et activation.',
    TRIntro:
      'Vous partez du Royaume-Uni en Turquie ? Comparez un forfait spécifique à la Turquie plutôt que de vous fier au nom d’une région ou de supposer que votre itinérance habituelle couvre le voyage.',
    TRTip1:
      'Lisez la liste réelle des pays : le mot Europe sur un forfait ne garantit pas la couverture en Turquie.',
    TRTip2:
      'Utilisez le Wi-Fi pour les sauvegardes et téléchargements, puis prévoyez les données mobiles pour les cartes et messages.',
    TRTip3:
      'Pour éviter l’itinérance de votre SIM habituelle, désactivez son itinérance des données et le basculement automatique des données.',
    TRQuestion1: 'Une eSIM Europe couvre-t-elle la Turquie ?',
    TRAnswer1:
      'Uniquement si la Turquie figure dans les pays du forfait concerné. Ajoutez-la à votre itinéraire pour comparer les forfaits qui la couvrent.',
    TRQuestion2: 'Comment éviter les frais d’itinérance de mon opérateur habituel ?',
    TRAnswer2:
      'Sélectionnez l’eSIM de voyage pour les données et suivez ses instructions d’itinérance. Désactivez séparément l’itinérance des données et le basculement automatique pour la SIM habituelle ; des frais d’appels et de SMS peuvent subsister.',
    AETitle: 'Forfaits eSIM de voyage aux Émirats arabes unis',
    AEDescription:
      'Comparez les données, la validité, l’activation et les prix actuels des eSIM aux Émirats arabes unis. Vérifiez les conditions avant le départ.',
    AEIntro:
      'Vous visitez les Émirats arabes unis ? Choisissez un volume et une durée adaptés, puis consultez les informations d’activation et de réseau du fournisseur. Gardez vos réservations essentielles hors ligne.',
    AETip1:
      'Pour une escale, vérifiez toute la durée de validité et le point de départ du forfait, pas seulement le volume.',
    AETip2:
      'L’accès aux données mobiles ne garantit pas la disponibilité de toutes les applications d’appels ou de messagerie à destination.',
    AETip3:
      'Pour poursuivre votre voyage, vérifiez chaque pays dans le planificateur ; un forfait émirati ne signifie pas une couverture régionale.',
    AEQuestion1: 'Une eSIM émiratie inclut-elle les appels classiques ?',
    AEAnswer1:
      'Les forfaits affichés sont réservés aux données. Consultez votre opérateur habituel si vous utilisez votre SIM principale pour les appels classiques ou les SMS.',
    AEQuestion2: 'Puis-je compter sur un réseau ou un débit précis ?',
    AEAnswer2:
      'Seuls les réseaux communiqués pour le forfait choisi sont indiqués. Couverture et débit dépendent du lieu, de l’appareil et du réseau ; aucun débit fixe n’est garanti.',
  },
  guideUi: {
    title: 'Guides eSIM de voyage',
    description:
      'Des guides pratiques pour choisir un forfait eSIM, estimer ses besoins en données, vérifier la compatibilité et installer en toute sécurité.',
    intro:
      'Préparez vos besoins en données pour le voyage. Commencez par les pays visités, le modèle exact de votre appareil et la règle d’activation du forfait choisi.',
    compare:
      'Prêt à comparer ? Découvrez les forfaits de voyage pour {us}, {gb}, {europe}, {jp} et {th}.',
    all: 'Tous les guides de voyage',
    policy:
      'Lisez la {refunds} avant l’installation. Pour toute question sur une commande, {support}.',
    notFound: 'Guide introuvable',
  },
  guideCopy: {
    usaTitle: 'Comment choisir une eSIM pour les États-Unis',
    usaDescription:
      'Une liste pratique pour comparer la couverture, le volume de données, la validité et la compatibilité des eSIM pour les États-Unis avant d’acheter.',
    usaDestination: 'Comparer les forfaits eSIM pour les États-Unis',
    usaHeading1: 'Commencez par votre itinéraire, pas par le prix d’appel le plus bas',
    usaParagraph1A:
      'Un forfait pour les États-Unis ne comprend pas automatiquement le Canada ou le Mexique. Notez chaque pays où vous aurez besoin de données, y compris les escales si vous comptez sortir de l’aéroport. Utilisez la recherche à destination unique pour les États-Unis seuls et la recherche multi-pays pour plusieurs étapes.',
    usaParagraph1B:
      'Si vous voyagez depuis le Royaume-Uni, comparez l’eSIM de voyage à l’offre d’itinérance réelle de votre opérateur habituel. Ne supposez pas que votre enveloppe nationale est utilisable à l’étranger au même prix.',
    usaHeading2: 'Comparez des offres équivalentes',
    usaParagraph2A:
      'Comparez un volume fixe, comme 10 Go, à d’autres volumes fixes pour toute la durée du voyage. Une enveloppe quotidienne est un produit différent : vérifiez si elle se renouvelle, réduit le débit ou arrête les données au plafond annoncé. Ne comparez pas ces offres à une mention « illimité » sans lire les conditions d’usage raisonnable.',
    usaParagraph2B:
      'Vérifiez ensemble la validité et le déclencheur d’activation. Un forfait moins cher de 7 jours peut ne pas couvrir un séjour de 10 jours, et un forfait démarrant à l’installation peut commencer avant le vol. Les réseaux, restrictions et pays sont indiqués dans les caractéristiques lorsqu’ils sont communiqués.',
    usaHeading3: 'Vérifiez le téléphone exact et les informations de livraison',
    usaParagraph3A:
      'Confirmez que votre modèle précis prend en charge l’eSIM et qu’il est débloqué tout opérateur. Le nom d’un modèle compatible ne suffit pas si une variante régionale ou un verrouillage empêche l’installation.',
    usaParagraph3B:
      'Utilisez une adresse e-mail accessible en Wi-Fi. Gardez confidentiels le lien sécurisé de commande et les informations d’installation. Avant d’acheter, lisez la politique de remboursement : l’installation ou l’activation peut modifier les possibilités d’annulation.',
    budgetTitle: 'Combien de données mobiles faut-il pour 7 ou 14 jours de vacances ?',
    budgetDescription:
      'Estimez votre budget de données selon votre utilisation habituelle, la durée du voyage, l’accès au Wi-Fi et le type de forfait.',
    budgetDestination: 'Comparer les destinations et les volumes de données',
    budgetHeading1: 'Partez de votre consommation récente',
    budgetParagraph1A:
      'Ouvrez les réglages de données mobiles et vérifiez la période mesurée. Un total mensuel ne correspond pas à une semaine. Regardez les applications que vous utiliserez en voyage et distinguez les données mobiles du Wi-Fi.',
    budgetParagraph1B:
      'À titre d’exemple arithmétique, sans promesse de consommation, 500 Mo par jour représentent environ 3,5 Go sur sept jours ou 7 Go sur quatorze jours, en unités décimales. Avec une marge de 20%, ces estimations atteignent environ 4,2 Go et 8,4 Go. Votre consommation réelle peut être très différente.',
    budgetHeading2: 'Repérez ce qui peut changer à l’étranger',
    budgetParagraph2A:
      'La navigation, les messages et les réservations ne consomment pas comme de longues vidéos, des appels vidéo ou un ordinateur en partage de connexion. Les sauvegardes de photos, mises à jour et téléchargements en arrière-plan peuvent consommer sans navigation visible.',
    budgetParagraph2B:
      'Téléchargez si possible les cartes, médias et gros fichiers en Wi-Fi. Vérifiez les téléchargements automatiques et sauvegardes cloud. Si vous comptez partager la connexion, confirmez d’abord les restrictions du forfait : tous ne permettent pas les mêmes usages.',
    budgetHeading3: 'Adaptez le volume et la validité',
    budgetParagraph3A:
      'Une enveloppe fixe de 10 Go dure jusqu’à son épuisement ou l’expiration du forfait, selon ses conditions. Un produit de 1 Go par jour a des règles quotidiennes et ne reporte pas nécessairement les données inutilisées. Lisez les modalités exactes de renouvellement et d’usage raisonnable.',
    budgetParagraph3B:
      'Prévoyez une validité suffisante et vérifiez son point de départ. Gardez une marge raisonnable pour les changements de voyage : un volume suffisant ne sert plus après l’expiration. Les mesures du réseau peuvent être retardées ; les compteurs du téléphone sont utiles au quotidien.',
    installTitle: 'Peut-on installer une eSIM avant de voyager ?',
    installDescription:
      'Distinguez installation et activation, vérifiez le début du forfait et préparez le code QR ou les informations manuelles en sécurité.',
    installDestination: 'Vérifier la compatibilité et l’installation eSIM',
    installHeading1: 'Installation et activation sont deux vérifications distinctes',
    installParagraph1A:
      'Il n’existe pas de réponse universelle. Certains forfaits commencent à l’achat, d’autres à l’installation, d’autres à la première connexion à un réseau pris en charge. Lisez la règle de votre forfait acheté avant de scanner le code QR.',
    installParagraph1B:
      'Si l’installation démarre la validité, une installation plusieurs jours avant le départ peut consommer une partie de la période avant le voyage. Si le forfait démarre à la connexion réseau, suivez les instructions et ne supposez pas une conservation illimitée : vérifiez aussi les délais de téléchargement ou d’activation.',
    installHeading2: 'Préparez-vous avant d’ouvrir le code QR',
    installParagraph2A:
      'Confirmez la compatibilité et le déblocage de l’appareil, puis connectez-vous à un Wi-Fi fiable. Ouvrez le lien sécurisé reçu par e-mail. Pour scanner un code QR, affichez-le sur un autre écran ; utilisez les informations manuelles fournies si nécessaire.',
    installParagraph2B:
      'Nommez clairement le nouveau profil pour le distinguer de votre SIM habituelle. Gardez le code QR et les informations d’activation confidentiels. Évitez de supprimer un profil installé : il peut n’être installable qu’une seule fois.',
    installHeading3: 'À destination',
    installParagraph3A:
      'Sélectionnez l’eSIM de voyage pour les données mobiles et suivez ses instructions d’itinérance. Vérifiez séparément l’itinérance des données et le basculement automatique de votre SIM habituelle.',
    installParagraph3B:
      'L’installation ou l’activation peut affecter le remboursement, même sans utilisation volontaire de données. Lisez la politique avant d’installer et contactez le support si la règle d’activation fournie est incertaine.',
    roamingTitle: 'Comment éviter les frais d’itinérance imprévus à l’étranger',
    roamingDescription:
      'Vérifiez votre SIM habituelle, comparez les coûts d’itinérance et choisissez une eSIM sans supposer qu’elle supprime toutes les catégories de frais.',
    roamingDestination: 'Comparer les forfaits de données de voyage',
    roamingHeading1: 'Vérifiez les frais réels de votre opérateur habituel',
    roamingParagraph1A:
      'Avant de partir, consultez les conditions de votre opérateur pour la destination exacte. Un pass quotidien, une enveloppe incluse et l’itinérance facturée à l’usage peuvent coûter très différemment. Notez si appels, SMS et données sont facturés séparément.',
    roamingParagraph1B:
      'Comparez le coût sur toute la durée du voyage avec une eSIM adaptée. Utilisez le prix après réduction valable, la devise indiquée et la période de validité complète. Une eSIM de voyage n’est pas systématiquement moins chère pour chaque voyageur.',
    roamingHeading2: 'Distinguez les deux profils SIM',
    roamingParagraph2A:
      'Choisissez l’eSIM de voyage comme ligne de données mobiles. Suivez ses propres instructions d’itinérance : certains profils nécessitent l’activation de l’itinérance pour rejoindre un réseau pris en charge.',
    roamingParagraph2B:
      'Pour éviter les données en itinérance de votre SIM habituelle, désactivez son itinérance et le basculement automatique. Les réglages varient selon l’appareil. Une ligne habituelle active pour appels ou SMS peut encore entraîner des frais ; une eSIM de données ne les supprime pas.',
    roamingHeading3: 'Évitez les surprises en arrière-plan',
    roamingParagraph3A:
      'Utilisez le Wi-Fi pour les gros téléchargements, mises à jour et sauvegardes de photos. Vérifiez les applications autorisées à utiliser les données et les mises à jour possibles sur un appareil connecté au partage de connexion.',
    roamingParagraph3B:
      'Consultez les règles d’usage raisonnable du forfait et surveillez la consommation. Une mesure fournisseur peut être retardée et ne garantit pas le solde en temps réel. Avant de passer une frontière, vérifiez que le nouveau pays est explicitement inclus.',
    compatibilityTitle: 'Compatibilité et activation eSIM : les points à vérifier avant l’achat',
    compatibilityDescription:
      'Vérifiez la variante exacte de votre appareil, son déblocage, les règles d’activation et les étapes d’installation sûre.',
    compatibilityDestination: 'Ouvrir la liste de compatibilité et d’installation',
    compatibilityHeading1: 'Vérifiez le modèle exact, sa région et le verrouillage opérateur',
    compatibilityParagraph1A:
      'Consultez les caractéristiques du fabricant pour le modèle précis et le pays d’achat. Une famille de modèles peut comporter des variantes régionales avec des SIM différentes. Cherchez l’option Ajouter une eSIM, mais vérifiez aussi le support du fabricant et le déblocage opérateur.',
    compatibilityParagraph1B:
      'Si le téléphone est verrouillé, demandez à l’opérateur les conditions et délais avant d’acheter un profil de voyage. Ne supposez pas qu’un déblocage sera possible à l’arrivée ou simplement parce que le matériel prend en charge l’eSIM.',
    compatibilityHeading2: 'Lisez les conditions du forfait avant l’installation',
    compatibilityParagraph2A:
      'Confirmez les pays, le type de volume, la validité, le déclencheur d’activation et toute échéance de téléchargement. Consultez les réseaux et restrictions communiqués : l’absence d’information sur le réseau ou le débit n’est pas une promesse.',
    compatibilityParagraph2B:
      'Un forfait de données ne donne pas droit à un numéro local, aux appels vocaux ou aux SMS. Si vous avez besoin de ces services, vérifiez séparément les conditions de votre opérateur habituel.',
    compatibilityHeading3: 'Installez en sécurité et gardez un recours',
    compatibilityParagraph3A:
      'Connectez-vous au Wi-Fi, ouvrez les informations sécurisées de votre commande et suivez les instructions du forfait concerné. Gardez l’accès à l’e-mail de livraison et ne partagez pas les informations d’activation.',
    compatibilityParagraph3B:
      'En cas de panne, vérifiez la ligne de données, la couverture et les instructions d’itinérance ou d’APN avant de supprimer le profil. Contactez le support Alozuri avec votre référence ; n’envoyez jamais les données complètes d’une carte ou un mot de passe. La page de compatibilité et la politique de remboursement indiquent la marche à suivre et les conditions applicables.',
  },
  helpUi: {
    eyebrow: 'UN COUP DE POUCE POUR LE VOYAGE',
    title: 'Connectons-vous.',
    intro: 'Vérifiez votre appareil, comprenez votre forfait et installez en confiance.',
    compatibility:
      'Votre appareil doit prendre en charge l’eSIM et être débloqué tout opérateur. Cherchez « Ajouter une eSIM » dans les réglages cellulaires. La compatibilité dépend du modèle exact et du pays d’achat ; confirmez-la auprès du fabricant ou de l’opérateur avant d’acheter.',
    unlock:
      'Sur iPhone, consultez Réglages → Général → Informations pour le verrouillage opérateur. Sur Android, contactez l’opérateur si le statut de déblocage est incertain.',
    beforeTitle: '1. Avant l’installation',
    before:
      'Connectez-vous à un Wi-Fi fiable. Ouvrez votre commande depuis votre compte. Vérifiez quand la validité commence : à l’achat, à l’installation ou à la première connexion à un réseau pris en charge, selon le forfait.',
    addTitle: '2. Ajoutez votre eSIM',
    add: 'iPhone : Réglages → Données cellulaires → Ajouter une eSIM. Android : Paramètres → Connexions / Réseau et Internet → Gestionnaire SIM / SIM → Ajouter une eSIM. Les menus varient selon l’appareil.',
    private:
      'Utilisez le code QR ou les informations d’activation manuelle fournis avec votre commande. Ne partagez jamais votre code d’activation.',
    arrivalTitle: '3. À destination',
    arrival:
      'Sélectionnez l’eSIM de voyage pour les données mobiles et suivez ses instructions d’itinérance. Désactivez l’itinérance des données et le basculement automatique de votre SIM habituelle pour éviter les frais de votre opérateur.',
    connectionTitle: 'La connexion ne fonctionne pas ?',
    connection:
      'Vérifiez que le forfait couvre le pays, que l’eSIM est sélectionnée pour les données et que les instructions d’activation et d’itinérance ont été suivies. Essayez brièvement le mode avion. Ne saisissez un APN que si la commande en fournit un. Évitez de supprimer l’eSIM installée : sa réinstallation peut être impossible.',
    readings:
      'Si le fournisseur communique des mesures d’utilisation, votre compte peut afficher le solde indiqué et l’heure de vérification. Ces mesures peuvent être retardées et ne garantissent pas un solde en temps réel.',
    moreGuides: 'Pour préparer votre voyage, lisez nos {guides}, notamment {budget}.',
    guideLabel: 'guides eSIM de voyage',
    budgetLabel: 'le budget de données pour 7 ou 14 jours',
    needHelp: 'Besoin d’aide supplémentaire ?',
    supportIntro: 'Écrivez à {support} ou consultez notre page de contact.',
    contact: 'Contacter le support',
  },
  countryUi: {
    search: 'Rechercher des destinations',
    available: '{count} destinations disponibles',
    compare: 'Comparer les forfaits de données',
    availabilityHint:
      'La disponibilité actuelle n’a pas pu être confirmée ici. Utilisez la recherche ci-dessous ; aucun prix ni couverture n’est garanti avant vérification.',
    localPlans: 'Découvrir les forfaits locaux',
    multiPlans: 'Découvrir les forfaits multi-pays',
    review:
      'Vérifiez les conditions complètes et le total actuel avant l’achat. Utilisez la recherche pour comparer les volumes et la couverture régionale.',
    conditions: 'Couverture, réseaux et activation',
    fullSpecs: 'Caractéristiques complètes et prix actuel',
    pricesError: 'Impossible de charger les prix dans cette devise. Réessayez avec la recherche.',
    directoryTitle: 'Où partirez-vous ensuite ?',
    directoryHint:
      'Choisissez une destination ou créez un itinéraire pour trouver un forfait pour chaque étape.',
    buildItinerary: 'Créer mon itinéraire',
    connected: 'Restez connecté : {country}.',
    travelData: 'DONNÉES DE VOYAGE',
    intro:
      '{country} : comparez les volumes de données et la validité pour votre voyage. Ouvrez un forfait pour consulter la couverture et l’activation communiquées par le fournisseur, ou ajoutez des pays pour un itinéraire multi-étapes.',
    networkMissing: 'Non communiqués pour ce forfait ; aucun opérateur précis n’est garanti.',
  },
  pageUi: {
    errorTitle: 'Un problème de connexion est survenu.',
    errorText: 'Veuillez réessayer d’ouvrir cette page.',
    notFoundEyebrow: 'UN PETIT DÉTOUR',
    notFoundTitle: 'Cette étape n’est pas sur la carte.',
    notFoundText: 'Cette page est introuvable. Reprenons votre voyage.',
    backHome: 'Retour à Alozuri',
  },
  supplierCopy: {
    reduced: '{size} à haut débit par jour, puis débit réduit ({speed}).',
    reducedPolicy:
      '{size} à haut débit par jour, puis débit réduit selon la politique d’usage raisonnable du fournisseur.',
    cutoff: '{size} par jour. Le service s’arrête à la limite quotidienne. {policy}',
    unlimited:
      'Le fournisseur décrit ce forfait comme illimité. Consultez le nom du forfait et ses conditions pour connaître les limitations de débit.',
    statusUnavailable:
      'État SM-DP+ : la consultation en ligne de l’état SM-DP+ n’est pas prise en charge.',
    usageUnavailable:
      'Utilisation : la consultation en ligne de l’utilisation n’est pas prise en charge.',
    usageContact:
      'Utilisation : la consultation en ligne n’est pas prise en charge. Contactez le support en ligne pour obtenir des informations.',
    validity15:
      'Validité : 15 jours à partir de la première utilisation. Elle commence à l’arrivée à destination, lors de la première utilisation des données mobiles. Le champ « Activate Time » ne correspond pas à l’heure réelle de première utilisation.',
    refundInUse:
      'Politique de remboursement du fournisseur : après l’achat, l’état de l’eSIM passe à IN USE. Le fournisseur n’accorde pas de remboursement, même pour les eSIM non utilisées.',
    salesMinimum:
      'Politique de vente du fournisseur : les revendeurs doivent respecter un prix de vente au public d’au moins USD {amount}, conformément au prix minimal imposé par l’opérateur fournisseur ; sinon, la revente du forfait peut être suspendue.',
    refundPurchase:
      'Politique de remboursement du fournisseur : aucun remboursement fournisseur n’est possible après l’achat.',
    usageConsole:
      'Utilisation : l’API de consultation n’est pas encore prise en charge. Actualisez la console du fournisseur pour consulter, à titre indicatif, les données restantes en temps réel.',
  },
  dashboardUi: {
    ordersError: 'Impossible de charger vos commandes. Veuillez réessayer.',
    actionError: 'L’opération n’a pas abouti. Patientez un instant et réessayez.',
    opening: 'Ouverture de votre compte…',
    greeting: 'Bonjour, {name}.',
    traveller: 'voyageur',
    title: 'Toutes vos aventures au même endroit.',
    hint: 'Vos forfaits, états de paiement et informations d’installation eSIM.',
    signedOut: 'Vous êtes déconnecté.',
    profileSyncError: 'Votre profil n’a pas pu être synchronisé. Veuillez réessayer.',
    retryProfile: 'Réessayer la synchronisation du profil',
    syncing: 'Synchronisation de votre profil…',
    preview: 'Connectez-vous pour gérer votre compte. Aucun achat d’exemple n’y est ajouté.',
    signinHint: 'Connectez-vous pour voir vos eSIM achetées.',
    verifyBefore: 'Vérifiez votre e-mail avant d’accéder à votre compte.',
    verifyInstruction: 'Ouvrez le lien de l’e-mail de vérification, puis vérifiez à nouveau.',
    verified: 'Vérifié',
    earlierEsims: 'Anciennes eSIM prêtes',
    earlierOrders: 'Anciennes commandes',
    accountStatus: 'État du compte',
    checkEmail: 'Vérifiez l’e-mail',
    guest: 'Invité',
    noEarlier: 'Aucune ancienne commande',
    ordersUnavailable: 'Les commandes sont temporairement indisponibles.',
    currentHint:
      'Retrouvez vos achats actuels et informations d’installation dans les onglets Commandes et Mes eSIM.',
    nextTrip: 'Préparer mon prochain voyage',
    details: 'Informations du compte',
    nameSaved: 'Votre nom a été mis à jour.',
    saveName: 'Enregistrer le nom',
    manageHint: 'Connectez-vous pour gérer votre profil.',
    takeoff: 'Prêt à décoller ?',
    installHint:
      'Vérifiez votre téléphone, installez en Wi-Fi et lisez les règles d’activation du forfait avant de partir.',
    installHelp: 'Aide à l’installation',
    usageDelay: 'Les informations d’utilisation peuvent avoir environ 2 à 3 heures de retard.',
  },
  legacyOrder: {
    choose: 'Choisissez une commande',
    chooseHint: 'Ouvrez une commande depuis votre compte pour voir son état.',
    stripePending:
      'Impossible de vérifier Stripe pour le moment. Votre paiement est peut-être encore en cours.',
    delayed:
      'Votre commande prend plus de temps que prévu. Actualisez son état ou contactez le support avant de lancer un autre paiement.',
    refunded:
      'Votre paiement a été remboursé. Votre banque peut mettre un certain temps à afficher le crédit.',
    expired: 'Cette session a expiré sans paiement confirmé.',
    paymentPending:
      'Votre paiement sera vérifié et votre eSIM apparaîtra ici après préparation. Vous pouvez revenir sur cette page à tout moment.',
    testComplete: 'Paiement de test terminé',
  },
  orderUi: {
    paymentStatus: 'Paiement : {status}',
    unitStatus: 'État : {status}',
    total: 'Total : {amount}',
    pdfFontError: 'Impossible de charger la police du PDF. Veuillez réessayer.',
    eyebrow: 'VOTRE COMMANDE ALOZURI',
    testOrder: 'Votre commande de test',
    readyTitle: 'Votre eSIM est prête.',
    onWayTitle: 'Votre eSIM arrive.',
    checkingTitle: 'Vérification de votre paiement',
    loadError:
      'Impossible de charger cette commande. Utilisez le lien privé de l’e-mail ou connectez-vous avec l’adresse de livraison.',
    checkAgain: 'Vérifier à nouveau',
    signinPurchases: 'Accéder à vos achats',
    privateLinkHint:
      'Ouvrez le lien privé de commande reçu par e-mail ou connectez-vous pour voir votre achat.',
    confirming: 'Confirmation de votre commande…',
    documents: 'Documents de commande',
    termsVersion: 'Version des conditions {version} · Acceptée le {date}',
    preparingPdf: 'Préparation du PDF…',
    downloadPdf: 'Télécharger votre contrat PDF',
    pdfPending: 'Le PDF sera disponible après confirmation du paiement.',
    pdfError: 'Impossible de télécharger votre contrat. Veuillez réessayer.',
    testNotice: 'Commande de test Stripe. Aucun débit réel ni émission d’eSIM.',
    supportNotice:
      'Votre paiement est enregistré. Votre commande nécessite une intervention avant la préparation de l’eSIM. Contactez {support} avec votre référence de commande.',
    preparingNotice:
      'Votre eSIM est en préparation. Cette page privée sera mise à jour quand les informations d’installation seront prêtes. L’e-mail de confirmation contient un lien vers cette page et votre contrat d’achat.',
    deliveryIssue:
      'La livraison nécessite une intervention. Contactez le support avec votre référence de commande.',
    refundNotice: 'Votre remboursement est en cours.',
    refresh: 'Actualiser l’état de la commande',
    guidance: 'Guide d’installation',
    title: 'Votre commande',
    quantityAmount: 'Quantité {quantity} · {amount}',
    purchasesError: 'Impossible de charger vos achats. Veuillez réessayer plus tard.',
    accountEyebrow: 'VOTRE ALOZURI',
    usageHint: 'Consultez l’utilisation des données de chaque eSIM livrée.',
    historyHint: 'Vos achats et informations d’installation au même endroit.',
    loginHint:
      'Connectez-vous avec votre adresse de livraison vérifiée pour retrouver vos achats. Les clients sans compte peuvent aussi utiliser le lien privé de l’e-mail de livraison.',
    retryPurchases: 'Réessayer le chargement des achats',
    loadingPurchases: 'Chargement des achats…',
    empty: 'Aucun achat pour le moment',
    viewOrder: 'Voir la commande et l’installation',
    testNoUsage: 'Commande de test. Aucune utilisation eSIM disponible.',
    unitWaiting: 'État de l’eSIM : {status}. L’utilisation sera disponible après la livraison.',
    earlierAccount: 'Anciennes commandes et paramètres du compte',
    cancelledUsage: 'L’utilisation est indisponible pour cette eSIM annulée ou remboursée.',
    supportUsage: 'Cette eSIM nécessite une intervention avant l’affichage de l’utilisation.',
    preparingUsage:
      'Votre eSIM est en préparation. L’utilisation sera disponible après la livraison.',
    emptyUsage: 'Aucune eSIM avec utilisation disponible pour le moment',
    paidAllocating:
      'Votre commande payée est en préparation. Votre eSIM apparaîtra ici après attribution.',
    liveUsageOnly:
      'L’utilisation est disponible pour les eSIM livrées. Les commandes de test ne contiennent pas d’eSIM réelle.',
    viewOrders: 'Voir les commandes',
  },
  usageUi: {
    error: 'Impossible de vérifier l’utilisation. Veuillez réessayer.',
    checking: 'Vérification de l’utilisation des données…',
    used: 'Données utilisées',
    remaining: 'Données restantes',
    total: 'Volume total',
    installation: 'Installation de l’eSIM',
    tran: 'N° Tran eSIM',
    supplierStatus: 'État fournisseur',
    expiry: 'Expiration',
    notYet: 'Pas encore communiqué',
    nonFixed:
      'Ce forfait affiche l’utilisation communiquée par le fournisseur. Le solde de données à haut débit n’est pas indiqué ici.',
    lastChecked: 'Dernière vérification : {date}',
    stale: 'Une ancienne mesure est affichée. Réessayez dans un instant.',
    pending:
      'L’utilisation n’a pas encore été communiquée ou une vérification est en cours. Réessayez dans un instant.',
    unavailable: 'L’utilisation est temporairement indisponible. Veuillez réessayer plus tard.',
    delay:
      'Les mesures du fournisseur peuvent avoir 2 à 3 heures de retard. Les forfaits quotidiens et illimités ont leurs propres règles de volume et d’usage raisonnable.',
    refresh: 'Actualiser l’utilisation',
  },
  status: {
    preparing: 'En préparation',
    ready: 'Prête',
    active: 'En service',
    depleted: 'Données épuisées',
    expired: 'Expirée',
    cancelled: 'Annulée',
    suspended: 'Suspendue',
    revoked: 'Révoquée',
    notReported: 'Non communiqué',
    readyInstall: 'Prête à installer',
    downloaded: 'Téléchargée ; installation non confirmée',
    installed: 'Installée',
    enabled: 'Installée · activée',
    disabled: 'Installée · désactivée',
    deleted: 'Supprimée',
    awaitingPayment: 'En attente de paiement',
    processing: 'Paiement en cours',
    paid: 'Payé',
    fulfilling: 'Préparation de l’eSIM',
    deliveryIssue: 'Livraison à vérifier',
    refundPending: 'Remboursement en cours',
    refunded: 'Remboursé',
    attention: 'À vérifier',
    failed: 'Échec du paiement',
  },
  planInfo: {
    unavailable: 'Forfait indisponible',
    search: 'Rechercher des forfaits',
    eyebrow: 'UN FORFAIT. TOUTES VOS ÉTAPES.',
    includes: 'Destinations incluses : {count}.',
    know: 'À savoir avant de partir',
    activation: 'Activation du forfait',
    networks: 'Réseaux',
    networkMissing: 'Aucune information réseau n’a été fournie pour ce forfait.',
    dataPolicy: 'Politique de données',
    calls: 'Appels et SMS',
    callsText: 'Données uniquement. Gardez votre SIM habituelle pour votre numéro actuel.',
    device: 'Vérifier la compatibilité de l’appareil',
    conditions: 'Conditions du forfait',
    rights: 'Vos droits légaux restent applicables. Consultez notre {refunds}.',
    summary: 'RÉSUMÉ DU FORFAIT',
    sample: 'FORFAIT D’EXEMPLE',
    sampleNotice: 'Exemple illustratif. Ce forfait ne peut pas être acheté.',
    adding: 'Ajout en cours…',
    basket: 'Préparation du panier…',
    retry: 'Réessayer le prix',
    added: 'Ajouté à votre panier.',
    viewCart: 'Voir le panier',
    limit: 'Limite du panier atteinte : cinq par forfait et dix eSIM par commande.',
    deviceNotice:
      'Votre appareil doit prendre en charge l’eSIM et être débloqué tout opérateur. Installez en Wi-Fi et suivez la règle d’activation.',
    refunds: 'Informations sur les remboursements',
    priceError: 'Impossible de charger le prix actuel. Veuillez réessayer.',
    addError: 'Impossible d’ajouter ce forfait. Veuillez réessayer.',
    localCoverage: 'Couverture locale',
    multiCoverage: 'Couverture multi-pays',
  },
  authUi: {
    verifyEyebrow: 'VÉRIFIEZ VOTRE E-MAIL',
    verifyTitle: 'Consultez votre boîte de réception',
    verifyIntro:
      'Ouvrez l’e-mail de vérification envoyé à {email}. Vérifiez votre adresse avant d’accéder à votre compte.',
    verifyDelay:
      'Si vous venez de vous inscrire, l’e-mail peut prendre un instant. Vérifiez aussi les indésirables.',
    verifiedButton: 'J’ai vérifié mon e-mail',
    resend: 'Renvoyer l’e-mail',
    another: 'Utiliser un autre compte',
    verifyNotYet:
      'Votre e-mail n’est pas encore vérifié. Ouvrez le lien de vérification puis réessayez.',
    verifyCheckError: 'Impossible de vérifier la confirmation. Veuillez réessayer.',
    verifySent:
      'E-mail de vérification envoyé. Consultez votre boîte de réception et les indésirables.',
    verifySendError: 'Impossible d’envoyer l’e-mail. Patientez un instant puis réessayez.',
    openingVerification: 'Ouverture de la vérification…',
    registerTitle: 'Votre prochaine aventure commence ici.',
    resetTitle: 'Un nouveau départ.',
    loginTitle: 'Heureux de vous retrouver.',
    artEyebrow: 'VOTRE MONDE, CONNECTÉ.',
    artTitleA: 'Moins de recherche de Wi-Fi.',
    artTitleB: 'Plus de moments à vivre.',
    artFooter: 'Un compte. Toutes vos aventures.',
    joinEyebrow: 'REJOIGNEZ LE VOYAGE',
    resetEyebrow: 'RÉINITIALISEZ VOTRE MOT DE PASSE',
    loginEyebrow: 'RAVI DE VOUS REVOIR',
    registerHint: 'Retrouvez vos eSIM, forfaits et aventures au même endroit.',
    resetHint: 'Saisissez votre e-mail pour recevoir un lien de réinitialisation.',
    loginHint: 'Connectez-vous pour retrouver vos eSIM et reprendre votre voyage.',
    ageNotice:
      'Les comptes et achats sont destinés aux personnes de 18 ans et plus. Consultez nos {terms} et notre {privacy}. La connexion ne vaut pas consentement au marketing ni au suivi facultatif du support.',
    unconfigured:
      'L’accès au compte est temporairement indisponible. Vous pouvez continuer à parcourir la boutique.',
    wait: 'Veuillez patienter…',
    google: 'Continuer avec Google',
    orEmail: 'ou continuer par e-mail',
    first: 'Prénom',
    last: 'Nom',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    passwordHint: 'Au moins 8 caractères',
    passwordPlaceholder: 'Votre mot de passe',
    hide: 'Masquer le mot de passe',
    show: 'Afficher le mot de passe',
    forgot: 'Mot de passe oublié ?',
    registerAgreement: 'J’accepte les {terms} et la {privacy}.',
    create: 'Créer mon compte',
    sendReset: 'Envoyer le lien',
    continueAccount: 'Accéder à votre compte',
    newHere: 'Vous découvrez Alozuri ?',
    alreadyMember: 'Vous faites déjà partie du voyage ?',
    backLogin: 'Retour à la connexion',
    secure: 'Votre prochaine aventure, connectée en toute sécurité.',
    resetSuccess:
      'Si un compte existe pour cette adresse, vous recevrez un lien pour réinitialiser le mot de passe.',
    guestTitle: 'Ou commander sans compte',
    guestHint: 'Aucun compte nécessaire.',
    verifyNotice:
      'Vous pouvez payer maintenant. {verify} pour accéder à vos commandes dans Mes eSIM.',
    guestUnconfigured:
      'La connexion au compte est indisponible ici. Vous pouvez continuer sans compte.',
    checkoutRegisterAgreement:
      'En créant un compte, vous acceptez nos {terms} et notre {privacy}. Les comptes sont réservés aux personnes de 18 ans et plus.',
    createCheckout: 'Créer un compte et rester au paiement',
    loginCheckout: 'Se connecter et rester au paiement',
    guestAlternative: 'Vous pouvez aussi continuer sans compte.',
    passwordRequired: 'Saisissez votre mot de passe.',
    passwordLength: 'Choisissez un mot de passe d’au moins 8 caractères.',
    checkingAccess: 'Vérification de l’accès au compte…',
    invalidCredential: 'L’adresse e-mail ou le mot de passe est incorrect.',
    invalidEmail: 'Saisissez une adresse e-mail valide.',
    strongerPassword: 'Choisissez un mot de passe plus sûr et réessayez.',
    emailInUse:
      'Un compte utilise déjà cet e-mail. Connectez-vous ou réinitialisez votre mot de passe.',
    weakPassword: 'Choisissez un mot de passe d’au moins huit caractères.',
    popupBlocked:
      'Votre navigateur a bloqué la connexion Google. Autorisez les fenêtres contextuelles et réessayez.',
    popupClosed: 'La connexion Google a été fermée. Réessayez lorsque vous êtes prêt.',
    tooMany: 'Trop de tentatives. Patientez un instant puis réessayez.',
    unauthorizedDomain: 'La connexion n’est pas encore disponible sur ce domaine.',
    methodDisabled: 'Ce mode de connexion n’est pas encore activé.',
    authError: 'Impossible de vous connecter. Veuillez réessayer.',
  },
  paymentUi: {
    declined: 'Votre carte a été refusée. Essayez un autre moyen de paiement.',
    policy:
      'En continuant, vous acceptez nos {terms} et reconnaissez avoir pris connaissance de notre {refunds} et de notre {privacy}.',
    orCard: 'ou payez par carte',
    formError: 'Impossible de charger le formulaire de paiement. Actualisez la page et réessayez.',
    processing: 'Traitement du paiement…',
    unavailable: 'Formulaire de paiement indisponible',
    loadingPayment: 'Chargement du paiement sécurisé…',
    loadingCheckout: 'Chargement de la commande…',
    availabilityError: 'Impossible de vérifier la disponibilité du paiement. Veuillez réessayer.',
    planUnavailable: 'Ce forfait est indisponible. Retournez au panier.',
    totalTimeout:
      'La confirmation du total a pris trop de temps. Votre panier est enregistré. Veuillez réessayer.',
    priceError: 'Impossible de vérifier les prix.',
    startError: 'Impossible de démarrer le paiement.',
    stripeError: 'Impossible de charger Stripe. Vérifiez votre connexion et réessayez.',
    loadingPlan: 'Chargement de votre forfait…',
    preparing: 'Préparation du paiement sécurisé…',
    signingIn: 'Finalisation de la connexion…',
    checkingAvailability: 'Vérification de la disponibilité du paiement…',
    confirmingTotal: 'Confirmation de votre total…',
    openingHint:
      'Ouverture des options de paiement. Vous pourrez vérifier le paiement avant tout débit.',
    signInHint: 'Terminez la connexion pour continuer. Votre commande est enregistrée.',
    confirmingHint:
      'Vous pouvez saisir vos informations pendant la confirmation de la commande. Vous pourrez vérifier le paiement avant tout débit.',
    syncHint: 'Résolvez le problème de synchronisation du panier avant de passer au paiement.',
    totalHint: 'Impossible de confirmer votre total. Réessayez ci-dessous.',
    paymentsHint: 'Les paiements sont actuellement indisponibles. Votre panier est enregistré.',
    compatibilityHint:
      'Confirmez ci-dessus que votre appareil prend en charge l’eSIM pour continuer.',
    editCart: 'Modifier le panier',
    deliveryEmail: 'E-mail de livraison : {email}',
    testNotice: 'Paiement de test. Aucun montant réel ne sera débité et aucune eSIM ne sera émise.',
    walletTimeout:
      'Le portefeuille n’a pas répondu. Payez par carte ci-dessous. Votre commande est inchangée et cette tentative n’a soumis aucun paiement.',
    syncingCart: 'Synchronisation du panier enregistré…',
    resolveCart: 'Retournez au panier pour résoudre ce problème avant de payer.',
    promotionQuestion: 'Vous avez un code promotionnel ?',
    promotionApplied:
      '{code} : {percent}% de réduction · Remise {discount} · Total initial {original}',
    compatible: 'Mon appareil prend en charge l’eSIM et est débloqué tout opérateur.',
    checkCompatibility: 'Vérifier la compatibilité',
    notConfigured:
      'Les paiements ne sont pas configurés pour cette boutique. Votre panier est enregistré.',
    retry: 'Réessayer le paiement',
    walletFailed: 'Le portefeuille n’a pas répondu. Veuillez payer par carte.',
    detailsError: 'Vérifiez vos informations de paiement.',
    furtherAction: 'Une action supplémentaire est nécessaire pour le paiement. Veuillez réessayer.',
  },
  cart: {
    discount: 'Réduction',
    activationLegacyNetwork:
      'Commence à la première connexion à un réseau compatible. Vérifiez le forfait acheté avant l’installation.',
    title: 'Votre panier',
    eyebrow: 'PRÊT POUR VOTRE PROCHAIN VOYAGE',
    orderTitle: 'VOTRE COMMANDE',
    intro: '{count} × eSIM · Prix en {currency}',
    summaryLine: '{allowance} · {validity} · Qté {quantity}',
    activation: 'Activation : {rule}',
    coverage: 'Couverture : {countries}',
    networks: 'Réseaux : {networks}',
    details: 'Détails du forfait',
    subtotal: 'Sous-total',
    total: 'Total · {currency}',
    priceNote:
      'Les prix sont vérifiés avant le paiement. Aucun frais supplémentaire au passage en caisse.',
    confirming: 'Vérification des prix actuels…',
    security: 'Stripe traite vos données de paiement en toute sécurité.',
    savedError: 'Impossible de charger le panier enregistré. Veuillez réessayer.',
    validationError: 'Impossible de vérifier le panier. Veuillez réessayer.',
    loading: 'Chargement de votre panier…',
    emptyTitle: 'Votre panier est vide',
    emptyText: 'Découvrez les forfaits eSIM pour votre prochaine destination.',
    useSaved: 'Utiliser le panier enregistré du compte',
    explore: 'Découvrir les destinations',
    unitPrice: '{amount} par eSIM',
    unavailablePrice: 'Indisponible · dernier prix :',
    quantity: 'Quantité pour {plan}',
    decrease: 'Réduire la quantité de {plan}',
    increase: 'Augmenter la quantité de {plan}',
    remove: 'Retirer',
    removeLabel: 'Retirer {plan}',
    continueShopping: 'Continuer mes achats',
    retryPrices: 'Réessayer les prix',
    saving: 'Enregistrement de votre panier…',
    secureCheckout: 'Paiement sécurisé',
    syncPending:
      'Le paiement sera disponible une fois la synchronisation du panier enregistré terminée.',
    syncFailed: 'Résolvez le problème de synchronisation indiqué ci-dessus avant de continuer.',
    removeUnavailable: 'Retirez les forfaits indisponibles pour passer au paiement.',
    syncError:
      'Le panier n’a pas pu être synchronisé. Réessayez ou utilisez le panier enregistré de votre compte.',
    activationNetwork: 'Commence à la première connexion à un réseau mobile pris en charge.',
    activationPurchase:
      'La validité commence après l’achat. Achetez uniquement lorsque vous êtes prêt à l’utiliser.',
    activationInstall:
      'La validité commence à l’installation de l’eSIM. Installez-la lorsque vous êtes prêt à l’utiliser.',
    fairFixed: 'Volume total de données fixe. Données uniquement, sans numéro de téléphone local.',
  },
  privacyUi: {
    chatFrame: 'Chat du service client Alozuri',
    choices: 'Vos choix de confidentialité',
    banner:
      'Le stockage essentiel permet la connexion, le panier et le paiement. Le chat facultatif Tawk.to et ses prestataires, dont Cloudflare, restent désactivés jusqu’à votre autorisation et l’ouverture du chat. La mesure publicitaire facultative de Meta reste désactivée jusqu’à votre consentement.',
    acceptAll: 'Tout accepter',
    reject: 'Refuser les options',
    customize: 'Personnaliser mes choix',
    storageRefused:
      'Votre navigateur n’a pas enregistré ce choix. Les technologies facultatives restent désactivées ; le support par e-mail est disponible.',
    storageFailed:
      'Impossible d’enregistrer vos préférences. Les technologies facultatives restent désactivées.',
    settingsHint:
      'Les achats et le support par e-mail fonctionnent sans consentement facultatif. Vous pouvez modifier vos choix à tout moment.',
    necessaryTitle: 'Nécessaire — toujours actif.',
    necessary:
      'Sessions du compte, panier, paiement sécurisé, langue et devise demandées et choix de confidentialité.',
    optionalSupportTitle: 'Support facultatif — Tawk.to.',
    optionalSupport:
      'Autorisez le chat lorsque vous décidez de l’ouvrir, y compris les outils d’analyse du service et de sécurité du prestataire. Nous ne transmettons pas automatiquement vos informations de compte ou de commande au chat.',
    advertisingTitle: 'Publicité facultative — Meta.',
    advertising:
      'Mesurer les publicités et les achats avec Meta Pixel et la mesure des achats confirmés.',
    measurement:
      'Meta mesure les pages et forfaits consultés, les débuts de paiement et les achats confirmés uniquement avec votre consentement publicitaire. Meta reçoit des identifiants de navigateur et d’événement, le montant et la devise de l’achat, pas les informations d’installation.',
    inventory: 'Consulter l’inventaire des cookies',
    save: 'Enregistrer mes choix',
    closeSettings: 'Fermer les réglages',
    chat: 'Discussion',
    closeChat: 'Fermer la discussion',
    chatTitle: 'Discuter avec Alozuri',
    chatPrivacy:
      'Le chat est fourni par Tawk.to et peut utiliser ses cookies et son stockage. Activez le support facultatif pour commencer. Nous ne partageons pas automatiquement vos informations de compte, de commande ou d’installation.',
    enableChat: 'Activer le chat',
    preferEmail: 'Vous préférez l’e-mail ?',
    privacyLink: 'Choix de confidentialité et de cookies',
    chatLoading: 'Le chat ne se charge pas ?',
    emailUs: 'Nous écrire',
    contactTitle: 'Choisissez comment nous contacter',
    emailWithoutConsent: 'Le support par e-mail fonctionne sans consentement facultatif.',
    openChat: 'Ouvrir le chat',
    chatSafety:
      'Le chat s’ouvre dans un coin sur ordinateur et en plein écran sur mobile. N’envoyez pas de mots de passe, de données complètes de carte, de codes QR ou d’identifiants d’activation. La disponibilité des agents n’est pas garantie.',
  },
  display: {
    unlimited: 'Illimité',
    daily: '{size}/jour',
    reduced: 'Illimité · {size}/jour à haut débit',
    featureTitle: 'Découvrez les eSIM régionales et mondiales',
    featureDescription:
      'Comparez les volumes de données et la couverture pour votre prochain voyage.',
    featureRegionAllowance: 'Volume de données pour {region}',
    featureView: 'Voir le forfait : {region} {amount} Go',
    featureCoverage: 'Couvre {count} pays',
    featureLoading: 'Chargement des forfaits actuels…',
    featureUnavailable: 'Forfaits actuellement indisponibles',
    featureRetry: 'Veuillez revenir plus tard.',
    featureError: 'Les prix sont temporairement indisponibles. Veuillez réessayer plus tard.',
    europe: 'Europe',
    asia: 'Asie',
    northAmerica: 'Amérique du Nord',
    global: 'Monde entier',
    seasonal: 'Idées de destinations de saison',
    photo: 'Inspiration de voyage : {country}',
    installIntro:
      'Connectez-vous au Wi-Fi avant l’installation. Suivez la règle d’activation de votre forfait et gardez ces informations confidentielles.',
    installLoading: 'Chargement des informations d’installation…',
    installShow: 'Afficher les informations d’installation',
    installQr: 'Votre code QR privé d’installation eSIM',
    installInstructions:
      'Sur votre téléphone, ouvrez Réglages → Données cellulaires/Réseau mobile → Ajouter une eSIM. Scannez ce code QR depuis un autre écran ou saisissez les informations ci-dessous manuellement.',
    smdp: 'Adresse SM-DP+',
    activationCode: 'Code d’activation',
    confirmationCode: 'Code de confirmation',
    installWarning:
      'Ne supprimez pas l’eSIM après l’installation, sauf demande du support. Certains profils ne peuvent être installés qu’une seule fois.',
    installError:
      'Impossible de charger les informations d’installation. Réessayez ou contactez le support avec votre référence de commande.',
  },
  search: {
    find: 'Trouver une eSIM',
    multi: 'Plusieurs pays',
    multiTrip: 'Voyage dans plusieurs pays',
    matcher: 'RECHERCHE D’ITINÉRAIRE',
    single: 'Une destination',
    whereTrip: 'Quels pays allez-vous visiter ?',
    whereCountry: 'Où partez-vous ?',
    tripHint: 'Ajoutez chaque étape. Trouvez une eSIM qui les couvre toutes.',
    countryHint: 'Trouvez un forfait de données pour votre prochaine destination.',
    covered: 'Chaque étape est couverte.',
    addAnother: 'Ajoutez une autre destination pour comparer les forfaits multi-pays.',
    chooseTwo: 'Choisissez au moins deux destinations pour un voyage multi-pays.',
    chooseOneNotice:
      'Choisissez un pays pour la recherche à destination unique. Votre itinéraire multi-pays sera conservé.',
    destinations: 'VOS DESTINATIONS',
    destination: 'VOTRE DESTINATION',
    remove: 'Retirer {country}',
    add: 'Ajouter une destination',
    change: 'Changer de destination',
    addStop: 'Ajouter une étape',
    choose: 'Choisir une destination',
    chooseCountry: 'Choisissez un pays',
    searchCountries: 'Rechercher des pays',
    searchPlaceholder: 'Rechercher un pays…',
    closeSearch: 'Fermer la recherche de pays',
    loadingDestinations: 'Chargement des destinations…',
    noDestinations: 'Aucune destination correspondante.',
    allData: 'Tous les forfaits de données',
    minimumData: '{amount} Go ou plus',
    daily: 'Forfaits de données quotidiens',
    unlimited: 'Illimité (voir l’usage raisonnable)',
    finding: 'Recherche de vos forfaits…',
    coverageChecked: 'Couverture vérifiée pour chaque pays sélectionné',
    demoNotice: 'Démonstration · forfaits d’exemple · achats désactivés',
    searching: 'Recherche des forfaits actuels…',
    refresh: 'Actualiser les résultats',
    matched: 'ADAPTÉ À VOTRE ITINÉRAIRE',
    localResults: 'Forfaits locaux pour {countries} : {count}.',
    tripResults: 'Forfaits couvrant toutes vos étapes : {count}.',
    noAllowance: 'Aucun forfait pour ce volume de données',
    noLocal: 'Aucun forfait local disponible',
    noCoverage: 'Aucun forfait ne couvre tous les pays sélectionnés',
    localExplanation: 'Ces forfaits couvrent uniquement le pays sélectionné.',
    tripExplanation: 'Couvre tous les pays sélectionnés : {countries}.',
    mismatchExplanation:
      'Forfaits couvrant vos destinations : {count}. Aucun ne correspond au volume de données sélectionné.',
    noLocalExplanation: 'Aucun forfait local n’est actuellement disponible pour ce pays.',
    noCoverageExplanation:
      'Aucun forfait unique ne couvre actuellement tous les pays sélectionnés. Essayez une autre combinaison.',
    sort: 'Trier les forfaits',
    recommended: 'Volumes de données recommandés',
    value: 'Prix par Go (volume fixe)',
    price: 'Prix total le plus bas',
    mostData: 'Le plus de données',
    showAll: 'Afficher tous les forfaits de données',
    showing: '{shown} forfaits affichés sur {total} correspondants',
    loadingMore: 'Chargement de la suite…',
    showMore: 'Voir plus de forfaits ({shown} sur {total})',
    destinationsError: 'Impossible de charger les destinations. Actualisez la page et réessayez.',
    chooseTwoError: 'Ajoutez au moins deux destinations pour une recherche multi-pays.',
    chooseOneError: 'Choisissez un pays avant de lancer une recherche à destination unique.',
    chooseFirstError: 'Ajoutez au moins une destination pour trouver votre eSIM.',
    searchError: 'Impossible de trouver des forfaits. Veuillez réessayer.',
    sampleCurrencyError: 'Les forfaits d’exemple sont disponibles uniquement en USD.',
    bestValue: 'MEILLEUR PRIX / Go',
    destinationsCount: '{count} destinations de voyage',
    dataOnly: 'Données uniquement',
    samplePrice: 'prix d’exemple',
    coverage: 'Destinations couvertes : {count}',
  },
  home: {
    heroTitleA: 'Une eSIM.',
    heroTitleB: 'Toutes vos étapes.',
    instant: 'Livraison immédiate',
    noRoaming: 'Sans surprise d’itinérance',
    tripConnected: 'VOTRE VOYAGE, CONNECTÉ',
    oneEsim: 'UNE eSIM',
    coversAll: 'Couvre tous les pays sélectionnés',
    onePlan: 'Un forfait au-delà des frontières',
    noSim: 'Aucune carte SIM à remplacer',
    secure: 'Paiement sécurisé avec Stripe',
    compare: 'Comparez les forfaits de voyage',
    dataNoDetours: 'Des données, sans détour',
    keepNumber: 'Gardez votre numéro',
    destinationsEyebrow: 'TROUVEZ VOTRE PROCHAINE CONNEXION',
    destinationsTitle: 'Quelle sera votre prochaine destination ?',
    destinationsDescription:
      'D’une escapade le temps d’un week-end au voyage dont vous rêvez depuis des années.',
    europeTitle: 'La France, la Suisse et l’Italie ? Oui, les trois.',
    europeDescription: 'Notre moteur vérifie chaque destination pour vous.',
    matchItinerary: 'Trouver pour mon itinéraire',
    stepsEyebrow: 'TROIS ÉTAPES. UN SOUCI EN MOINS.',
    stepsTitle: 'Connecté en un rien de temps.',
    checkDevice: 'Vérifier votre appareil',
    stepChooseTitle: 'Choisissez vos destinations',
    stepChooseText:
      'Ajoutez tous les pays de votre itinéraire. Comparez les forfaits qui couvrent chacune de vos étapes.',
    stepInstallTitle: 'Installez votre eSIM',
    stepInstallText:
      'Votre eSIM apparaît dans votre compte dès qu’elle est prête. Scannez le code QR avec une connexion Wi-Fi stable.',
    stepConnectTitle: 'Atterrissez. Connectez-vous. Profitez.',
    stepConnectText:
      'Sélectionnez votre eSIM pour les données mobiles et activez son itinérance des données. Suivez les règles d’activation de votre forfait.',
    faqEyebrow: 'AVANT DE PARTIR',
    faqTitle: 'Les réponses à vos questions.',
    faqIntro: 'Un voyage demande déjà assez d’organisation. Se connecter devrait être simple.',
    faqLink: 'Consulter le centre d’aide',
    faqCoverageQuestion: 'Une seule eSIM fonctionne-t-elle dans tous les pays de mon voyage ?',
    faqCoverageAnswer:
      'Oui, si le forfait comprend tous les pays sélectionnés. Notre recherche n’affiche que les forfaits qui couvrent l’ensemble de votre itinéraire. La Suisse et le Royaume-Uni sont vérifiés séparément : « Europe » ne signifie pas automatiquement tous les pays européens.',
    faqPhoneQuestion: 'Mon téléphone est-il compatible ?',
    faqPhoneAnswer:
      'Votre téléphone doit prendre en charge l’eSIM et être débloqué tout opérateur. Cherchez « Ajouter une eSIM » dans les réglages du réseau mobile et vérifiez auprès du fabricant la compatibilité de votre modèle exact et de sa région d’achat avant de commander.',
    faqNumberQuestion: 'Puis-je garder WhatsApp et mon numéro ?',
    faqNumberAnswer:
      'Oui. Gardez votre SIM habituelle pour les appels et votre numéro WhatsApp. Sélectionnez Alozuri pour les données mobiles et désactivez l’itinérance des données de votre SIM habituelle pour éviter les frais de votre opérateur.',
    faqStartQuestion: 'Quand mon forfait commence-t-il ?',
    faqStartAnswer:
      'Cela dépend du forfait. Certains commencent à l’installation, d’autres à la première connexion à un réseau pris en charge. Les détails du forfait et la page d’installation précisent la règle d’activation.',
    finalEyebrow: 'VOTRE PROCHAIN VOYAGE, SIMPLIFIÉ',
    finalTitle: 'Moins d’itinérance. Plus d’évasion.',
    finalText: 'Votre prochaine connexion commence par vos destinations.',
    findEsim: 'Trouver mon eSIM',
  },
  site: {
    operations: 'Opérations',
    cookieSettings: 'Paramètres des cookies',
    skip: 'Aller au contenu',
    languageUnsupported: 'Cette langue n’est pas prise en charge.',
    languageLoadError: 'Impossible de charger cette langue. Veuillez réessayer.',
    languageSaveError:
      'La langue a été modifiée sur cet appareil, mais votre préférence n’a pas pu être enregistrée dans votre compte.',
    home: 'Accueil Alozuri',
    mainNav: 'Navigation principale',
    currency: 'Devise',
    cartCount: '{count, plural, one {Panier, # article} other {Panier, # articles}}',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    myAccount: 'Mon compte',
    verifyEmail: 'Vérifier mon e-mail',
    accountNav: 'Navigation du compte',
    myEsims: 'Mes eSIM',
    usage: 'Consommation de données',
    orders: 'Commandes',
    settings: 'Paramètres du compte',
    loggingOut: 'Déconnexion…',
    logoutError: 'La déconnexion a échoué. Veuillez réessayer.',
    explore: 'Explorer',
    allDestinations: 'Toutes les destinations',
    itinerary: 'Préparer votre itinéraire',
    europeEsims: 'eSIM de voyage pour l’Europe',
    guides: 'Guides des eSIM de voyage',
    partners: 'Partenaires',
    legal: 'Informations légales',
    support: 'Aide et assistance',
    compatibility: 'Compatibilité et installation eSIM',
    contact: 'Contact et réclamations',
    createAccount: 'Créer un compte',
    sloganA: 'Moins de roaming.',
    sloganB: 'Plus de découvertes.',
    office: 'Siège social',
    company:
      '{brand} est un nom commercial de {company}, société immatriculée en Angleterre et au pays de Galles sous le numéro {number}.',
    copyright: '© {year} Alozuri. Pour vous accompagner en voyage.',
    acceptableUse: 'Utilisation acceptable, usage raisonnable et couverture',
  },
  common: {
    language: 'Langue',
    loading: 'Chargement…',
    retry: 'Réessayer',
    save: 'Enregistrer',
    cancel: 'Annuler',
    back: 'Retour',
    unavailableLanguage: 'Cette langue n’est pas encore disponible.',
  },
  navigation: {
    destinations: 'Destinations',
    howItWorks: 'Comment ça marche',
    help: 'Centre d’aide',
    login: 'Se connecter',
    signup: 'Créer un compte',
    cart: 'Panier',
    logout: 'Se déconnecter',
  },
  plans: {
    view: 'Voir le forfait',
    add: 'Ajouter au panier',
    buy: 'Acheter maintenant',
    loadingPrice: 'Chargement du prix…',
    unavailable: 'Prix indisponible',
    allowance: 'Volume de données',
    validity: 'Validité',
    coverage: 'Couverture',
    days: '{count, plural, one {# jour} other {# jours}}',
  },
  checkout: {
    legalUnavailable:
      'Le paiement et les documents de commande sont actuellement disponibles en anglais. Passez à l’anglais pour continuer : votre panier et votre devise seront conservés.',
    useEnglish: 'Continuer en anglais',
    title: 'Finaliser la commande',
    deliveryEmail: 'E-mail de réception',
    emailHint: 'Nous enverrons les instructions d’installation de votre eSIM à cette adresse.',
    continue: 'Passer au paiement',
    securePayment: 'Paiement sécurisé',
    apply: 'Appliquer le code',
    remove: 'Retirer le code',
    promotionalCode: 'Code promotionnel',
    pay: 'Payer {amount}',
  },
  errors: {
    promoNotApplicable:
      'Ce code ne peut pas être appliqué à cette commande. Essayez un autre code ou retirez-le pour continuer.',
    catalogueChanged: 'Le catalogue a changé. Actualisez votre recherche.',
    searchPageInvalid: 'Cette page de résultats n’est plus valide. Lancez une nouvelle recherche.',
    generic: 'Une erreur est survenue. Veuillez réessayer.',
    promoInvalid: 'Ce code promotionnel n’est pas valide.',
    promoExpired: 'Ce code promotionnel a expiré.',
    authentication: 'Connectez-vous pour continuer.',
    planUnavailable: 'Ce forfait n’est plus disponible.',
    paymentFailed: 'Le paiement n’a pas pu être effectué. Veuillez réessayer.',
    paymentCancelled: 'Le paiement a été annulé.',
    rateLimited: 'Trop de demandes. Patientez un instant, puis réessayez.',
  },
  account: {
    language: 'Langue préférée',
    profile: 'Votre profil',
    orders: 'Vos commandes',
  },
  installation: {
    unitDetails: 'Informations d’installation de l’eSIM {number}',
    unitQr: 'Code QR privé pour installer l’eSIM {number}',
    title: 'Installer votre eSIM',
    wifi: 'Connectez-vous au Wi-Fi avant l’installation.',
    private: 'Gardez vos informations d’installation confidentielles.',
  },
  emails: {
    confirmationSubject: 'Confirmation de votre commande d’eSIM Alozuri',
    confirmed: 'Votre commande est confirmée !',
    ready: 'Votre eSIM est prête à être installée.',
    reference: 'Référence de commande : {reference}',
  },
  legal: {
    terms: 'Conditions générales',
    privacy: 'Politique de confidentialité',
    cookies: 'Politique relative aux cookies',
    refunds: 'Politique de remboursement et d’annulation',
  },
} satisfies Messages;
