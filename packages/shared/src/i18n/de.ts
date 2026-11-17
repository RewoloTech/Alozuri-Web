// DRAFT: requires native-speaker review; legal labels are not legal documents.
import type { Messages } from './messages.ts';
export const messages = {
  photoUi: {
    JP: 'Traditionelle Straßen in Kyoto, Japan',
    IT: 'Bunte Küstenhäuser in den Cinque Terre, Italien',
    US: 'Die Freiheitsstatue in New York, USA',
    TR: 'Heißluftballons über den Felsformationen von Kappadokien, Türkei',
    FR: 'Der Eiffelturm in Paris, Frankreich',
    CH: 'Verschneite Berge und ein gefrorener See im Engadin, Schweiz',
    TH: 'Wat Arun am Fluss in Bangkok, Thailand',
    AU: 'Das Opernhaus von Sydney am Hafen von Sydney, Australien',
    BR: 'Die Christusstatue über Rio de Janeiro, Brasilien',
    ZA: 'Der Tafelberg in Kapstadt, Südafrika',
    AE: 'Der Burj Khalifa in Dubai, Vereinigte Arabische Emirate',
    EG: 'Eine Pyramide in der Wüste bei Gizeh, Ägypten',
  },
  transactionUi: {
    purchaseContract: 'Dein Kaufvertrag',
    yourOrder: 'Deine Bestellung',
    legalAcceptanceTimestamp: 'Zeitpunkt der rechtlichen Zustimmung',
    taxNotRecorded: 'Steuer wurde bei dieser Bestellung nicht gesondert erfasst.',
    wifiStep: 'Verbinde dein Handy mit WLAN.',
    title: 'Alozuri — Bestellbestätigung und Vertrag',
    confirmedPurchase: 'Dein bestätigter Kauf',
    orderPlaced: 'Bestellt am',
    paidAt: 'Zahlung bestätigt am',
    timestampMissing: 'Zeitstempel in dieser Bestellantwort nicht enthalten',
    testPayment: 'Testzahlung erfolgreich — keine echte Belastung oder eSIM',
    customerName: 'Kundenname',
    purchasedPlans: 'Gekaufte Tarife',
    planReference: 'Tarifreferenz',
    includedCountries: 'Enthaltene Länder',
    activationRule: 'Aktivierungsregel',
    restrictions: 'Einschränkungen und Fair Use',
    noRestrictions: 'Keine zusätzliche Einschränkung vermerkt.',
    supplierConditions: 'Anbieterbedingungen',
    quantity: 'Menge',
    unitPrice: 'Stückpreis',
    lineTotal: 'Positionssumme',
    paymentTotal: 'Zahlungssumme',
    tax: 'Gesondert berechnete Steuer',
    taxMissing: 'Nicht gesondert erfasst',
    taxDoc:
      'Für diese Bestellung sind kein Steuersatz und keine Umsatzsteuerregistrierung vermerkt. Dies ist eine Bestellbestätigung mit Vertrag.',
    legalAcceptance: 'Erfasste rechtliche Zustimmung',
    acceptedAt: 'Akzeptiert am',
    termsVersion: 'Version der Allgemeinen Geschäftsbedingungen',
    refundVersion: 'Version der Erstattungs- und Stornierungsrichtlinie',
    effectiveDate: 'Gültigkeitsdatum der Richtlinie',
    totalPaid: 'Bezahlt insgesamt',
    orderReference: 'Bestellreferenz',
    purchaseDate: 'Kaufdatum und -zeit',
    contractDate: 'Vertragsdatum und -zeit',
    seller: 'Verkäufer',
    companyNumber: 'Unternehmensnummer',
    contact: 'Kontakt',
    contractIncludes:
      'Die oben unter Deine Bestellung aufgeführten Tarifdetails, Länder, Gültigkeit, Aktivierung und Einschränkungen gehören zu diesem Kaufvertrag.',
    thanks: 'Danke, dass du Alozuri gewählt hast. Öffne deine eSIM über die sichere Bestellseite.',
    ready:
      'Deine eSIM ist bereit. Öffne die sichere Bestellseite für QR-Code und manuelle Installation.',
    pending:
      'Deine Bestellung wird bearbeitet. Die sichere Bestellseite zeigt den Status und nach der Bereitstellung QR-Code, manuelle Installationsdaten und Aktivierung. Du kannst jederzeit über denselben Link zurückkehren.',
    activationNote:
      'Prüfe vor der Installation die unten genannte Aktivierungsregel jedes Tarifs. Manche beginnen bei Installation, erster Netzverbindung oder Kauf; beachte die für deinen Kauf gespeicherte Regel.',
    important:
      'Dein Gerät muss eSIM unterstützen und entsperrt sein. Schütze QR-Code, Installationsdaten und privaten Bestelllink. Die gespeicherten Regeln zu Aktivierung, Gültigkeit, Datenvolumen und Fair Use stehen oben. Hilfe: support@alozuri.com.',
    access: 'Deine eSIM öffnen',
    viewInstall: 'eSIM ansehen und installieren',
    installReady: 'Installieren, wenn du bereit bist',
    openOrder: 'Öffne deine sichere Alozuri-Bestellseite.',
    scan: 'Scanne den eSIM-QR-Code oder folge der manuellen Installationsanleitung.',
    enable: 'Aktiviere deine Alozuri-eSIM in den Mobilfunkeinstellungen.',
    roaming: 'Schalte bei Bedarf Datenroaming für die Alozuri-eSIM ein.',
    connect: 'Verbinde dich entsprechend den Aktivierungsbedingungen mit einem unterstützten Netz.',
    importantTitle: 'Wichtige Informationen',
    originalRetail: 'Ursprünglicher Verkaufspreis',
    promotion: 'Aktion {code} ({percent}%)',
    taxPresent:
      'Gesondert berechnete Steuer: {amount}. Für diese Bestellung sind kein Steuersatz und keine Umsatzsteuerregistrierung vermerkt.',
    paymentStatus: 'Zahlungsstatus',
  },
  legalUi: {
    about: 'Über Alozuri',
    eyebrow: 'ALOZURI · RECHTLICHE HINWEISE UND KUNDENINFORMATIONEN',
    effective: 'Gültig ab {date} · Version {version}',
    version: 'Fassung {version}',
    permanent: 'Dauerhafter Versionslink',
    contents: 'Auf dieser Seite',
    scroll: 'Wische oder scrolle, um alle Spalten zu sehen.',
    related: 'Weitere Richtlinien',
    archived: 'Archivierte Richtlinienversion',
    previous: 'Frühere Fassung: {title}',
    request: 'Für eine Kopie dieser Richtlinienversion wende dich an {support}.',
    orderCopies:
      'Deine Kaufbedingungen stehen weiterhin in der Bestellbestätigung und den herunterladbaren Dokumenten auf deiner privaten Bestellseite.',
    unchanged:
      'Diese Aktualisierung ändert nicht die bereits zu deinem Kauf gehörenden Bedingungen.',
    current: 'Aktuelle Fassung lesen: {title}',
    notice:
      'Mit deiner Bestellung stimmst du unseren Allgemeinen Geschäftsbedingungen zu und nimmst unsere Erstattungsrichtlinie, Datenschutzerklärung und eSIM-Kompatibilitätsanforderungen zur Kenntnis.',
    documentHeader: 'Version {version} — gültig ab {date}',
  },
  seoUi: {
    homeTitle: 'Alozuri Reise-eSIMs für internationale Reisen',
    homeDescription:
      'Vergleiche Prepaid-eSIM-Daten für ein Land oder mehrere Ziele. Prüfe bestätigte Abdeckung, Volumen, Gültigkeit und Aktivierung vor der Zahlung.',
    destTitle: 'Reiseziele für eSIMs',
    destDescription:
      'Entdecke eSIM-Reiseziele und vergleiche lokale sowie länderübergreifende Datentarife. Prüfe Abdeckung, Volumen, Gültigkeit und Aktivierung.',
    helpTitle: 'Hilfe und eSIM-Installation',
    helpDescription:
      'Hilfe bei Gerätekompatibilität, Installation der Reise-eSIM, Aktivierung und Kontakt mit Alozuri.',
    planDescription:
      '{allowance} Reisedaten für {days}. Prüfe bestätigte Länderabdeckung, Aktivierung und Fair-Use-Bedingungen vor dem Kauf.',
    planTitle: 'Tarifdetails',
    planUnavailable: 'Prüfe die aktuelle eSIM-Verfügbarkeit und bestätigte Tarifangaben.',
    tagline: 'Alozuri — Eine eSIM. Jeder Stopp.',
  },
  partnersUi: {
    metaTitle: 'Alozuri-Partnerprogramm — Jetzt Partner werden',
    metaDescription:
      'Werde Alozuri-Partner: 10% Provision für berechtigte eSIM-Empfehlungen, 30 Tage Tracking und ein eigenes Partner-Dashboard.',
    eyebrow: 'ALOZURI-PARTNER',
    title: 'Werde Partner von Alozuri',
    intro:
      'Hilf Reisenden weltweit in Verbindung zu bleiben und verdiene Provision mit Empfehlungen für Alozuri-eSIMs.',
    apply: 'Partner werden',
    free: 'Die Teilnahme ist kostenlos. Bewerbungen müssen genehmigt werden.',
    benefitsTitle: 'Eine Partnerschaft, die sich lohnt.',
    commissionTitle: '10% Provision',
    commission:
      'Verdiene 10% auf jeden berechtigten eSIM-Kauf, der deiner Empfehlung zugeordnet wird.',
    trackingTitle: '30 Tage Tracking',
    tracking:
      'Erhalte eine Gutschrift für berechtigte Käufe innerhalb von 30 Tagen nach der Empfehlung.',
    dashboardTitle: 'Eigenes Dashboard',
    dashboard:
      'Behalte Empfehlungen, Verkäufe und Provisionen in deinem Partner-Dashboard im Blick.',
    applyStep: 'Bewerben',
    applyText: 'Bewirb dich für das Alozuri-Partnerprogramm.',
    shareStep: 'Teilen',
    shareText:
      'Nach der Freigabe erhältst du deinen persönlichen Empfehlungslink und kannst Alozuri auf deinen Kanälen vorstellen.',
    earnStep: 'Verdienen',
    earnText: 'Verdiene an berechtigten Käufen und verfolge deine Ergebnisse im Partner-Dashboard.',
    audienceTitle: 'Wer kann mitmachen?',
    audienceIntro:
      'Ob du Reiseinhalte erstellst oder Reisen planst: Mit Alozuri kannst du durch Empfehlungen internationaler eSIM-Datentarife unkompliziert verdienen.',
    youtube: 'Reise-YouTuber',
    creators: 'Content-Creator und Influencer',
    blogs: 'Reiseblogger und Verlage',
    agencies: 'Reisebüros',
    communities: 'Reise-Communitys',
    termsEyebrow: 'VON ANFANG AN KLAR',
    paymentsTitle: 'Provisionen und Auszahlungen',
    paymentsIntro: 'Ein einfaches Programm mit klaren Teilnahmebedingungen.',
    termCommission: '10% Provision auf berechtigte Käufe.',
    termWindow: '30 Tage Empfehlungs-Tracking.',
    termAttribution: 'Zuordnung nach dem letzten Klick.',
    termPending: 'Provisionen bleiben 30 Tage nach dem Kauf ausstehend.',
    termMinimum: 'Mindestauszahlung: Gegenwert von 50 USD.',
    termPaid: 'Genehmigte Provisionen werden monatlich über unterstützte Methoden ausgezahlt.',
    termExcluded:
      'Erstattete, stornierte, betrügerische oder zurückgebuchte Transaktionen sind ausgeschlossen.',
    faqIntro: 'Das solltest du vor der Bewerbung wissen.',
    q1: 'Ist die Teilnahme kostenlos?',
    a1: 'Ja. Bewerbung und Teilnahme sind gebührenfrei.',
    q2: 'Wer kann Partner werden?',
    a2: 'Reise-Creator, Blogger, Verlage und passende Unternehmen können sich bewerben. Jede Bewerbung wird geprüft.',
    q3: 'Wie viel kann ich verdienen?',
    a3: 'Partner erhalten 10% Provision auf berechtigte Käufe, die ihren Empfehlungen zugeordnet werden.',
    q4: 'Wie werden Empfehlungen erfasst?',
    a4: 'Bis zu 30 Tage, abhängig von der nötigen Einwilligung und der Verfügbarkeit des Trackings.',
    q5: 'Wann werde ich bezahlt?',
    a5: 'Genehmigte Provisionen werden monatlich ausgezahlt, sobald dein auszahlbares Guthaben den Gegenwert von 50 USD erreicht.',
    q6: 'Wo sehe ich meine Einnahmen?',
    a6: 'Freigegebene Partner können ihr Endorsely-Partner-Dashboard nutzen.',
    finalTitle: 'Gemeinsam wachsen.',
    finalText:
      'Werde Alozuri-Partner und verdiene, indem du Reisenden bei ihrer Verbindung hilfst.',
    finalApply: 'Als Partner bewerben',
    newTab: 'öffnet in einem neuen Tab',
  },
  regionUi: {
    title: 'Reise-eSIMs für mehrere Länder Europas',
    description:
      'Vergleiche Europa-eSIMs für Reisen durch mehrere Länder. Prüfe Länder, aktuellen Preis, Gültigkeit und Aktivierung; die regionale Abdeckung variiert.',
    eyebrow: 'REISEDATEN FÜR MEHRERE LÄNDER',
    heading: 'Europa-eSIMs für deine Reiseroute',
    intro:
      'Du reist aus den USA oder anderswo in mehrere europäische Länder? Vergleiche einen Datentarif mit deinen tatsächlichen Stopps. Europa ist ein Regionsname und garantiert nicht alle europäischen Länder.',
    example:
      'Die folgenden Beispiele decken {countries} ab. Öffne die jeweilige Länderliste oder ändere die Route im Planer. Kein Tarif wird als Abdeckung für ganz Europa bezeichnet.',
    tip1: 'Füge jedes Reiseland hinzu, auch Zwischenstopps mit mobilem Datenbedarf.',
    tip2: 'Verlasse dich nicht darauf, dass Großbritannien, die Schweiz oder die Türkei bei einem Europa-Paket enthalten sind.',
    tip3: 'Wähle für einen Europa-Vergleich mit 10 GB dieses Volumen und vergleiche Gültigkeit und vollständige Länderliste. Prüfe bei Bedarf die Hotspot-Bedingungen.',
    question1: 'Kann eine eSIM mehrere europäische Länder abdecken?',
    answer1:
      'Ja, wenn die bestätigte Länderliste jedes Reiseland enthält. Der Planer verlangt alle ausgewählten Länder; ein lokaler Tarif für nur einen Halt ist kein vollständiger Treffer.',
    question2: 'Muss ich in jedem Land eine eigene eSIM installieren?',
    answer2:
      'Ein regionales Profil kann je nach Abdeckung und Aktivierungsbedingungen mehrere Länder umfassen. Prüfe den Tarif, statt überall denselben Betreiber oder dieselbe Geschwindigkeit vorauszusetzen.',
    oneCountry: 'Nur ein Reiseland? Vergleiche {gb} oder {destinations}.',
    adviceTitle: 'Plane deine mobilen Daten vor der Reise',
    questions: 'Häufige Fragen',
    adviceLinks:
      'Prüfe die {compatibility}, lies {installation} oder die {refunds}. Installation und Aktivierung können die Stornierungsberechtigung beeinflussen; die Richtlinie erläutert Ausnahmen und Verbraucherrechte.',
    compatibility: 'Gerätekompatibilität',
    installation: 'wann du deine eSIM installieren solltest',
    notFound: 'Reiseziel nicht gefunden',
    genericTitle: '{country}: Reise-eSIM',
    genericDescription:
      'Vergleiche Reisedaten, Volumen, Gültigkeit und Aktivierung für {country}. Finde lokale Abdeckung oder plane mehrere Länder.',
  },
  destinationCopy: {
    USTitle: 'Reise-eSIMs für die USA – aus Großbritannien und anderen Ländern',
    USDescription:
      'Vergleiche USA-eSIMs nach Datenvolumen, Gültigkeit, aktuellem Preis und Aktivierung. Prüfe die Abdeckung für einzelne Ziele und Rundreisen.',
    USIntro:
      'Du reist von Großbritannien in die USA? Vergleiche Prepaid-Daten für Karten, Nachrichten und Buchungen, ohne dein heimisches Roaming vorauszusetzen. Wähle einen USA-Tarif oder prüfe jeden Halt deiner Reise.',
    USTip1: 'Wähle eine Gültigkeit für Ankunft bis Abreise und prüfe, wann sie beginnt.',
    USTip2:
      'Ein USA-Paket enthält nicht automatisch Kanada oder Mexiko. Ergänze diese Ziele bei Bedarf im Reiseplaner.',
    USTip3:
      'Nutze für einen Vergleich mit 10 GB den Datenfilter und vergleiche neben dem Preis auch Gültigkeit und Datenregeln.',
    USQuestion1: 'Funktioniert eine USA-eSIM auf meinem britischen Handy?',
    USAnswer1:
      'Dein genaues Modell muss eSIM unterstützen und ohne SIM-Lock sein. Prüfe dies vor dem Kauf beim Hersteller und Anbieter; das Kaufland garantiert keine Kompatibilität.',
    USQuestion2: 'Enthält eine USA-eSIM eine amerikanische Rufnummer?',
    USAnswer2:
      'Die angezeigten Pakete bieten mobile Daten. Eine lokale Rufnummer, normale Anrufe oder SMS sind nicht automatisch enthalten. Internetanrufe und Nachrichten verbrauchen Datenvolumen.',
    GBTitle: 'Reise-eSIMs für Besucher Großbritanniens',
    GBDescription:
      'Vergleiche Prepaid-eSIM-Daten, Gültigkeit und aktuelle Preise für Großbritannien. Prüfe Gerätekompatibilität, Netze und Aktivierung.',
    GBIntro:
      'Du besuchst Großbritannien aus den USA oder einem anderen Land? Vergleiche Daten für Navigation, Buchungen und Kontakt unterwegs. Prüfe vor der Zahlung, ob dein Handy entsperrt ist.',
    GBTip1:
      'Ist dein US-Handy finanziert oder an einen Anbieter gebunden, kläre die Voraussetzungen zur Entsperrung vor der Reise.',
    GBTip2:
      'Geht es weiter nach Europa? Ein reiner UK-Tarif deckt das nächste Land nicht automatisch ab; vergleiche eine Reise mit mehreren Ländern.',
    GBTip3:
      'Prüfe bei jedem Paket die Länderliste; nahe Inseln oder Gebiete sind nicht automatisch enthalten.',
    GBQuestion1: 'Können Reisende aus den USA eine UK-eSIM kaufen?',
    GBAnswer1:
      'Du kannst als Gast vergleichen und kaufen. Dein Handy muss das bereitgestellte eSIM-Profil unterstützen und entsperrt sein; die Staatsangehörigkeit bestimmt nicht die Gerätekompatibilität.',
    GBQuestion2: 'Ist Großbritannien bei einer Europa-eSIM dabei?',
    GBAnswer2:
      'Nur wenn der konkrete Tarif Großbritannien ausdrücklich aufführt. Ein Regionsname belegt keine Abdeckung; prüfe vor dem Kauf die enthaltenen Länder.',
    JPTitle: 'Reise-eSIM-Datentarife für Japan',
    JPDescription:
      'Vergleiche Datenvolumen, Gültigkeit, aktuelle Preise und Aktivierungsregeln für Japan-eSIMs. Prüfe unterstützte Netze und Gerätekompatibilität.',
    JPIntro:
      'Du planst eine Japanreise? Plane Daten für Navigation, Übersetzungen, Nachrichten und Reservierungen. Vergleiche feste Datenmengen mit Tagespaketen und prüfe, was nach Verbrauch des Tagesvolumens geschieht.',
    JPTip1:
      'Lade Karten und große Sprachpakete vor der Abreise per WLAN herunter, um mobile Daten zu sparen.',
    JPTip2:
      'Nicht jedes Paket beginnt bei der Ankunft. Lies vor der Installation die Aktivierungsregel.',
    JPTip3:
      'Ergänze bei einer Asienreise jedes Ziel, statt andere Länder in einem Japan-Paket vorauszusetzen.',
    JPQuestion1: 'Kann ich eine Japan-eSIM vor dem Flug installieren?',
    JPAnswer1:
      'Das hängt von der Aktivierungsregel ab. Bei manchen Profilen beginnt die Gültigkeit mit der Installation; prüfe das gekaufte Paket vor dem Scannen des QR-Codes.',
    JPQuestion2: 'Welche japanischen Netze kann ich nutzen?',
    JPAnswer2:
      'Maßgeblich sind die für den konkreten Tarif genannten Netze. Ohne Angaben des Anbieters verspricht Alozuri keinen bestimmten Betreiber oder Datendurchsatz.',
    THTitle: 'eSIM-Datentarife für Thailandurlauber',
    THDescription:
      'Vergleiche Thailand-eSIMs nach Datenvolumen, Gültigkeit und aktuellem Preis. Lies die Angaben zu Netz, Aktivierung und Tageslimit.',
    THIntro:
      'Wähle Daten für Thailand passend zur Reisedauer und deiner Nutzung. Karten, Transfers, Nachrichten und Videos verbrauchen unterschiedlich viel; vergleiche Volumen und Gültigkeit gemeinsam.',
    THTip1:
      'Prüfe bei einem 7-tägigen Urlaub, ob die Gültigkeit beim Kauf, bei der Installation oder bei der ersten Verbindung mit einem unterstützten Netz beginnt.',
    THTip2:
      'Ein Tagespaket kann nach dem Tageslimit die Geschwindigkeit reduzieren oder Daten stoppen; lies die angegebene Regel.',
    THTip3:
      'Besuchst du weitere Länder, ergänze sie im Planer, damit jeder Halt abgedeckt sein muss.',
    THQuestion1: 'Ist eine Reise-eSIM dasselbe wie eine lokale Telefon-SIM?',
    THAnswer1:
      'Die angezeigten Alozuri-Pakete bieten nur Daten. Eine lokale Rufnummer oder SMS sind nicht automatisch enthalten.',
    THQuestion2: 'Bedeutet unbegrenzt auch ohne Einschränkungen?',
    THAnswer2:
      'Nein. Lies bei dieser Bezeichnung die Fair-Use- und Geschwindigkeitsregeln des Anbieters. Feste oder tägliche Datenmengen sind oft leichter vergleichbar.',
    TRTitle: 'Reise-eSIM-Datentarife für die Türkei',
    TRDescription:
      'Vergleiche Türkei-eSIMs und aktuelle Preise für britische Reisende und andere Besucher. Prüfe Abdeckung, Gültigkeit und Aktivierung.',
    TRIntro:
      'Du reist von Großbritannien in die Türkei? Vergleiche einen Türkei-Tarif, statt dich auf einen Regionsnamen oder dein heimisches Roamingpaket zu verlassen.',
    TRTip1:
      'Prüfe die tatsächliche Länderliste: Die Bezeichnung Europa bei einem anderen Tarif garantiert keine Türkei-Abdeckung.',
    TRTip2:
      'Nutze WLAN für Sicherungen und Downloads und plane mobile Daten für Navigation und Nachrichten.',
    TRTip3:
      'Deaktiviere Datenroaming und automatischen Datenwechsel deiner heimischen SIM, wenn du deren Roaming vermeiden möchtest.',
    TRQuestion1: 'Deckt eine Europa-eSIM die Türkei ab?',
    TRAnswer1:
      'Nur wenn die Türkei in der Länderliste des konkreten Pakets steht. Ergänze sie im Reiseplaner, um passende Tarife zu finden.',
    TRQuestion2: 'Wie vermeide ich Roamingkosten meines heimischen Anbieters?',
    TRAnswer2:
      'Wähle die Reise-eSIM für mobile Daten und beachte deren Roaming-Anleitung. Deaktiviere separat Datenroaming und automatischen Datenwechsel der heimischen SIM; Anruf- und SMS-Gebühren können dennoch entstehen.',
    AETitle: 'Reise-eSIM-Datentarife für die VAE',
    AEDescription:
      'Vergleiche Datenvolumen, Gültigkeit, Aktivierung und aktuelle eSIM-Preise für die Vereinigten Arabischen Emirate. Prüfe die Tarifbedingungen.',
    AEIntro:
      'Du besuchst die Vereinigten Arabischen Emirate? Wähle Volumen und Gültigkeit für deinen Aufenthalt und lies die Aktivierungs- und Netzangaben des Anbieters. Halte wichtige Buchungen offline bereit.',
    AETip1:
      'Prüfe bei einem Zwischenstopp die gesamte Gültigkeit und ihren Beginn, statt nur nach Datenmenge zu wählen.',
    AETip2:
      'Mobile Daten garantieren nicht, dass jede Anruf- oder Nachrichten-App am Reiseziel verfügbar ist.',
    AETip3:
      'Prüfe für die Weiterreise jedes Land im Planer; ein VAE-Paket bedeutet keine automatische regionale Abdeckung.',
    AEQuestion1: 'Enthält eine VAE-eSIM normale Telefonanrufe?',
    AEAnswer1:
      'Die angezeigten Pakete bieten nur Daten. Prüfe die Bedingungen deines heimischen Anbieters, wenn du mit der heimischen SIM normal telefonieren oder SMS senden möchtest.',
    AEQuestion2: 'Kann ich mit einem bestimmten Netz oder Tempo rechnen?',
    AEAnswer2:
      'Genannt werden nur tatsächlich für das gewählte Paket bereitgestellte Netze. Abdeckung und Tempo hängen von Standort, Gerät und Netzbedingungen ab; eine feste Geschwindigkeit wird nicht versprochen.',
  },
  guideUi: {
    title: 'Ratgeber zu Reise-eSIMs',
    description:
      'Praktische Tipps zur Auswahl von eSIM-Datenpaketen, zum Datenbedarf, zur Kompatibilität und zur sicheren Installation.',
    intro:
      'Plane deinen Datenbedarf für die Reise. Beginne mit den Reiseländern, deinem genauen Gerätemodell und der Aktivierungsregel des gewählten Pakets.',
    compare:
      'Bereit zum Vergleichen? Entdecke Reiseangebote für {us}, {gb}, {europe}, {jp} und {th}.',
    all: 'Alle Reiseratgeber',
    policy:
      'Lies vor der Installation die {refunds}. Bei Fragen zu einer Bestellung kannst du {support}.',
    notFound: 'Ratgeber nicht gefunden',
  },
  guideCopy: {
    usaTitle: 'So wählst du eine eSIM für die USA',
    usaDescription:
      'Eine praktische Checkliste für USA-eSIMs: Abdeckung, Datenvolumen, Gültigkeit und Kompatibilität vor dem Kauf vergleichen.',
    usaDestination: 'eSIM-Tarife für die USA vergleichen',
    usaHeading1: 'Beginne mit deiner Route, nicht mit dem niedrigsten Werbepreis',
    usaParagraph1A:
      'Ein Tarif für die USA gilt nicht automatisch für Kanada oder Mexiko. Notiere jedes Land, in dem du Daten brauchst, auch bei Zwischenstopps, wenn du den Flughafen verlassen möchtest. Nutze die Einzelzielsuche für eine reine USA-Reise und die Mehrländersuche für weitere Stopps.',
    usaParagraph1B:
      'Vergleiche als Reisender aus dem Vereinigten Königreich die Reise-eSIM mit dem tatsächlichen Roamingangebot deines Mobilfunkanbieters. Gehe nicht davon aus, dass dein Inlandspaket im Ausland zum gleichen Preis gilt.',
    usaHeading2: 'Vergleiche Gleiches mit Gleichem',
    usaParagraph2A:
      'Vergleiche ein festes Volumen wie 10 GB mit anderen festen Volumen für die gesamte Reisedauer. Ein tägliches Volumen ist ein anderes Produkt: Prüfe, ob es zurückgesetzt wird, die Geschwindigkeit sinkt oder Daten nach dem Tageslimit stoppen. Vergleiche diese Angebote nicht mit „unbegrenzt“, ohne die Fair-Use-Bedingungen zu lesen.',
    usaParagraph2B:
      'Prüfe Gültigkeit und Aktivierungsbeginn zusammen. Ein günstigerer 7-Tage-Tarif reicht möglicherweise nicht für einen 10-tägigen Aufenthalt. Ein Tarif mit Beginn bei Installation kann schon vor dem Flug starten. Netze, Einschränkungen und Länder sind in den Tarifdetails aufgeführt, soweit bereitgestellt.',
    usaHeading3: 'Prüfe das genaue Handy und die Zustelldaten',
    usaParagraph3A:
      'Bestätige, dass dein genaues Gerätemodell eSIM unterstützt und vom Anbieter entsperrt ist. Ein eSIM-fähiger Modellname genügt nicht, wenn eine regionale Variante oder ein SIM-Lock die Installation verhindert.',
    usaParagraph3B:
      'Nutze eine E-Mail-Adresse, die du über WLAN erreichst. Halte den sicheren Bestelllink und die Installationsdaten privat. Lies vor dem Kauf die Erstattungsrichtlinie: Installation oder Aktivierung können die Stornierungsmöglichkeiten beeinflussen.',
    budgetTitle: 'Wie viel mobile Daten brauchst du für 7 oder 14 Urlaubstage?',
    budgetDescription:
      'Schätze dein Reisedatenbudget anhand deiner bisherigen Nutzung, Reisedauer, WLAN-Verfügbarkeit und Tarifart.',
    budgetDestination: 'Reiseziele und Datenvolumen vergleichen',
    budgetHeading1: 'Beginne mit deiner eigenen bisherigen Nutzung',
    budgetParagraph1A:
      'Öffne die Einstellungen für mobile Daten und prüfe den Messzeitraum. Verwechsle einen Monatswert nicht mit dem Verbrauch einer Woche. Betrachte die Apps, die du unterwegs nutzen wirst, und unterscheide mobile Daten von WLAN-Nutzung.',
    budgetParagraph1B:
      'Als reines Rechenbeispiel, nicht als Verbrauchszusage: 500 MB täglich ergeben in Dezimaleinheiten etwa 3,5 GB für sieben oder 7 GB für vierzehn Tage. Mit 20% Reserve wären das ungefähr 4,2 GB und 8,4 GB. Dein tatsächlicher Verbrauch kann stark abweichen.',
    budgetHeading2: 'Überlege, was sich im Ausland ändert',
    budgetParagraph2A:
      'Navigation, Nachrichten und Buchungsbestätigungen verbrauchen anders als lange Videos, Videoanrufe oder ein Laptop am Hotspot. Foto-Backups, Systemupdates und App-Downloads im Hintergrund können ohne sichtbare Browsersitzung Daten nutzen.',
    budgetParagraph2B:
      'Lade Karten, Medien und große Dateien nach Möglichkeit per WLAN. Prüfe automatische Downloads und Cloud-Backups. Wenn du die Verbindung teilen möchtest, bestätige zuerst die Hotspot-Beschränkungen des gewählten Pakets. Nicht jeder Tarif erlaubt dieselbe Nutzung.',
    budgetHeading3: 'Achte auf Datenvolumen und Gültigkeit',
    budgetParagraph3A:
      'Ein festes Volumen von 10 GB gilt gemäß den Bedingungen bis zum Verbrauch oder Ablauf des Pakets. Ein Produkt mit 1 GB pro Tag hat tägliche Regeln und überträgt ungenutzte Daten möglicherweise nicht. Lies die genaue Regel zum Zurücksetzen und zu Fair Use.',
    budgetParagraph3B:
      'Wähle genügend Gültigkeit und prüfe den Beginn. Plane eine sinnvolle Reserve für Reiseänderungen ein. Genügend Daten helfen nicht, wenn die Gültigkeit abgelaufen ist. Netzseitige Nutzungswerte können verzögert sein; die Zähler deines Geräts helfen bei der täglichen Kontrolle.',
    installTitle: 'Kannst du eine eSIM vor der Reise installieren?',
    installDescription:
      'Unterscheide Installation und Aktivierung, prüfe die Startregel des Tarifs und bereite QR-Code oder manuelle Angaben sicher vor.',
    installDestination: 'eSIM-Kompatibilität und Installation prüfen',
    installHeading1: 'Installation und Aktivierung sind getrennte Prüfungen',
    installParagraph1A:
      'Es gibt kein allgemeingültiges Ja oder Nein. Manche Pakete beginnen beim Kauf, andere bei der Installation und wieder andere bei der ersten unterstützten Netzverbindung. Lies vor dem Scannen des QR-Codes die Regel deines gekauften Tarifs.',
    installParagraph1B:
      'Beginnt die Gültigkeit bei Installation, können vorzeitig installierte Tage bereits vor deiner Reise verbraucht werden. Beginnt sie mit einer unterstützten Netzverbindung, befolge die Installationsanleitung und gehe nicht von unbegrenzter Lagerfähigkeit aus. Prüfe auch Download- und Aktivierungsfristen.',
    installHeading2: 'Bereite dich vor dem Öffnen des QR-Codes vor',
    installParagraph2A:
      'Bestätige Gerätekompatibilität und SIM-Lock-Freiheit und verbinde dich mit zuverlässigem WLAN. Öffne den sicheren Bestelllink aus deiner Zustell-E-Mail. Zeige einen zu scannenden QR-Code auf einem zweiten Bildschirm an oder nutze die bereitgestellten manuellen Angaben.',
    installParagraph2B:
      'Benenne das neue Profil eindeutig, damit du es von deiner Heim-SIM unterscheiden kannst. Halte QR-Code und Aktivierungsdaten privat. Lösche kein installiertes Profil: Manche lassen sich nur einmal installieren.',
    installHeading3: 'Am Reiseziel',
    installParagraph3A:
      'Wähle die Reise-eSIM für mobile Daten und beachte die Roaming-Anweisungen dieses Profils. Prüfe Datenroaming und automatischen Datenwechsel deiner Heim-SIM separat.',
    installParagraph3B:
      'Installation oder Aktivierung können die Erstattungsmöglichkeiten beeinflussen, auch ohne bewusste Datennutzung. Lies die Erstattungsrichtlinie vor der Installation und frage den Support, wenn die mitgelieferte Aktivierungsregel unklar ist.',
    roamingTitle: 'So vermeidest du unerwartete Roaminggebühren im Ausland',
    roamingDescription:
      'Prüfe die Einstellungen deiner Heim-SIM, vergleiche Roamingkosten und wähle eine Reise-eSIM, ohne die Abdeckung aller Gebührenarten anzunehmen.',
    roamingDestination: 'Reise-Datentarife vergleichen',
    roamingHeading1: 'Prüfe, was dein Mobilfunkanbieter tatsächlich berechnet',
    roamingParagraph1A:
      'Prüfe vor der Reise die Bedingungen deines Anbieters für das genaue Ziel. Ein täglicher Roamingpass, ein enthaltenes Volumen und nutzungsabhängiges Roaming können sehr unterschiedlich kosten. Beachte, ob Anrufe, SMS und Daten getrennt berechnet werden.',
    roamingParagraph1B:
      'Vergleiche die Kosten für die gesamte Reise mit einer passenden Reise-eSIM. Berücksichtige einen gültigen Rabatt, die angegebene Währung und die volle Gültigkeit. Eine Reise-eSIM ist nicht automatisch für jeden günstiger.',
    roamingHeading2: 'Halte die beiden SIM-Profile getrennt',
    roamingParagraph2A:
      'Wähle die Reise-eSIM als Leitung für mobile Daten. Befolge ihre eigenen Roaming-Anweisungen: Manche Reiseprofile brauchen aktiviertes Datenroaming für die Verbindung mit unterstützten Netzen.',
    roamingParagraph2B:
      'Deaktiviere Datenroaming und automatischen Datenwechsel deiner Heim-SIM, wenn du deren Roaming-Datennutzung vermeiden möchtest. Die Einstellungen unterscheiden sich je nach Gerät. Eine für Anrufe oder SMS aktive Heimleitung kann weiterhin Gebühren verursachen. Eine reine Daten-eSIM beseitigt diese Gebühren nicht.',
    roamingHeading3: 'Vermeide Überraschungen im Hintergrund',
    roamingParagraph3A:
      'Nutze WLAN für große Downloads, Updates und Foto-Backups. Prüfe, welche Apps mobile Daten verwenden dürfen und ob ein über Hotspot verbundenes Gerät Updates herunterladen könnte.',
    roamingParagraph3B:
      'Beachte die Fair-Use-Regeln des gewählten Tarifs und überwache den Verbrauch. Anbietermesswerte können verzögert sein und garantieren kein Echtzeitguthaben. Bestätige beim Grenzübertritt, dass das nächste Land ausdrücklich enthalten ist, bevor du denselben Tarif nutzt.',
    compatibilityTitle: 'eSIM-Kompatibilität und Aktivierung: vor dem Kauf prüfen',
    compatibilityDescription:
      'Prüfe deine genaue Gerätevariante, den SIM-Lock, die Aktivierungsregeln und sichere Installationsschritte.',
    compatibilityDestination: 'Checkliste für Kompatibilität und Installation öffnen',
    compatibilityHeading1: 'Prüfe Modell, Region und SIM-Lock genau',
    compatibilityParagraph1A:
      'Nutze die Herstellerangaben für dein genaues Modell und Kaufland. Eine Modellfamilie kann regionale Varianten mit unterschiedlicher SIM-Unterstützung haben. Suche nach „eSIM hinzufügen“, bestätige aber auch die Herstellerunterstützung und den Entsperrstatus.',
    compatibilityParagraph1B:
      'Ist dein Handy gesperrt, frage vor dem Kauf eines Reiseprofils deinen Anbieter nach Voraussetzungen und Dauer der Entsperrung. Gehe nicht davon aus, dass dies nach der Ankunft klappt oder allein wegen eSIM-fähiger Hardware möglich ist.',
    compatibilityHeading2: 'Lies die Paketbedingungen vor der Installation',
    compatibilityParagraph2A:
      'Prüfe benötigte Länder, Datenart, Gültigkeit, Aktivierungsbeginn und etwaige Downloadfrist. Beachte die bereitgestellten Netze und Einschränkungen des Anbieters. Fehlende Netz- oder Geschwindigkeitsangaben sind keine Zusage.',
    compatibilityParagraph2B:
      'Ein Datentarif allein umfasst keine lokale Telefonnummer, Sprachdienste oder SMS. Wenn du diese Dienste benötigst, prüfe separat die Bedingungen deines Heimanbieters.',
    compatibilityHeading3: 'Installiere sicher und behalte eine Hilfsmöglichkeit',
    compatibilityParagraph3A:
      'Verbinde dich mit WLAN, öffne die sicheren Installationsdaten deiner Bestellung und befolge die Anleitung für das tatsächliche Paket. Behalte Zugang zur Zustell-E-Mail und teile Aktivierungsdaten nicht mit anderen.',
    compatibilityParagraph3B:
      'Prüfe bei Verbindungsfehlern Datenleitung, Abdeckung sowie bereitgestellte Roaming- und APN-Anweisungen, bevor du das Profil löschst. Kontaktiere Alozuri mit deiner Bestellreferenz. Sende niemals vollständige Kartendaten oder Passwörter. Die Kompatibilitätsseite und Erstattungsrichtlinie erläutern weitere Schritte und geltende Bedingungen.',
  },
  helpUi: {
    eyebrow: 'ETWAS HILFE FÜR DIE REISE',
    title: 'Wir bringen dich ins Netz.',
    intro: 'Prüfe dein Gerät, verstehe deinen Tarif und installiere sicher.',
    compatibility:
      'Dein Gerät muss eSIM unterstützen und ohne SIM-Lock sein. Suche in den Mobilfunkeinstellungen nach „eSIM hinzufügen“. Die Kompatibilität hängt vom genauen Modell und Kaufland ab. Bestätige sie vor dem Kauf beim Hersteller oder Anbieter.',
    unlock:
      'Auf dem iPhone findest du den SIM-Lock unter Einstellungen → Allgemein → Info. Frage bei Android deinen Anbieter, wenn der Entsperrstatus unklar ist.',
    beforeTitle: '1. Vor der Installation',
    before:
      'Verbinde dich mit einem zuverlässigen WLAN. Öffne deine Bestellung im Konto. Prüfe, wann die Gültigkeit beginnt: beim Kauf, bei der Installation oder bei der ersten unterstützten Netzverbindung, je nach Tarif.',
    addTitle: '2. eSIM hinzufügen',
    add: 'iPhone: Einstellungen → Mobilfunk → eSIM hinzufügen. Android: Einstellungen → Verbindungen / Netzwerk und Internet → SIM-Manager / SIMs → eSIM hinzufügen. Menüs unterscheiden sich je nach Gerät.',
    private:
      'Nutze den QR-Code oder die manuellen Aktivierungsdaten aus deiner Bestellung. Teile deinen Aktivierungscode niemals.',
    arrivalTitle: '3. Am Reiseziel',
    arrival:
      'Wähle die Reise-eSIM für mobile Daten und beachte ihre Roaming-Anweisungen. Deaktiviere Datenroaming und automatischen Datenwechsel für deine Heim-SIM, um Anbietergebühren zu vermeiden.',
    connectionTitle: 'Verbindung funktioniert nicht?',
    connection:
      'Prüfe die Länderabdeckung, die gewählte Daten-SIM sowie Aktivierungs- und Roaming-Anweisungen. Aktiviere kurz den Flugmodus. Gib nur einen APN ein, wenn deine Bestellung einen nennt. Lösche keine installierte eSIM: Eine erneute Installation wird möglicherweise nicht unterstützt.',
    readings:
      'Wenn der Anbieter Nutzungswerte liefert, kann dein Konto den gemeldeten Stand und Prüfzeitpunkt zeigen. Messwerte können verzögert sein und sind keine Echtzeitgarantie.',
    moreGuides: 'Weitere Tipps findest du in unseren {guides}, unter anderem zu {budget}.',
    guideLabel: 'Reise-eSIM-Ratgebern',
    budgetLabel: 'einem Datenbudget für 7 oder 14 Tage',
    needHelp: 'Noch Fragen?',
    supportIntro: 'Schreibe an {support} oder besuche unsere Kontaktseite.',
    contact: 'Support kontaktieren',
  },
  countryUi: {
    search: 'Reiseziele suchen',
    available: '{count} verfügbare Reiseziele',
    compare: 'Datentarife vergleichen',
    availabilityHint:
      'Die aktuelle Verfügbarkeit konnte hier nicht bestätigt werden. Prüfe die Optionen unten in der Reisesuche. Preis und Abdeckung werden erst nach Prüfung zugesichert.',
    localPlans: 'Lokale Tarife entdecken',
    multiPlans: 'Mehrländertarife entdecken',
    review:
      'Prüfe vor dem Kauf die vollständigen Tarifbedingungen und den aktuellen Gesamtbetrag. Vergleiche alle Datenvolumen und regionale Abdeckungen in der Reisesuche.',
    conditions: 'Abdeckung, Netze und Aktivierung',
    fullSpecs: 'Vollständige Tarifdetails und aktueller Preis',
    pricesError:
      'Preise in dieser Währung konnten nicht geladen werden. Versuche es in der Reisesuche erneut.',
    directoryTitle: 'Wohin reist du als Nächstes?',
    directoryHint:
      'Wähle ein Ziel oder erstelle eine Route, um einen Tarif für jeden Stopp zu finden.',
    buildItinerary: 'Meine Route erstellen',
    connected: '{country}: verbunden bleiben.',
    travelData: 'REISEDATEN',
    intro:
      '{country}: Vergleiche Datenvolumen und Gültigkeit für deine Reise. Öffne einen Tarif für die vom Anbieter gemeldete Abdeckung und Aktivierungsregel oder füge Länder für eine Mehrländerreise hinzu.',
    networkMissing:
      'Für dieses Paket nicht angegeben; es wird kein bestimmter Betreiber zugesichert.',
  },
  pageUi: {
    errorTitle: 'Es gibt ein Verbindungsproblem.',
    errorText: 'Versuche, diese Seite erneut zu öffnen.',
    notFoundEyebrow: 'EIN KLEINER UMWEG',
    notFoundTitle: 'Dieser Stopp steht nicht auf der Karte.',
    notFoundText: 'Diese Seite wurde nicht gefunden. Zurück zu deiner Reise.',
    backHome: 'Zurück zu Alozuri',
  },
  supplierCopy: {
    reduced: '{size} Highspeed pro Tag, danach reduzierte Geschwindigkeit ({speed}).',
    reducedPolicy:
      '{size} Highspeed pro Tag, danach reduzierte Geschwindigkeit gemäß Fair-Use-Regelung des Anbieters.',
    cutoff: '{size} pro Tag. Der Dienst endet am Tageslimit. {policy}',
    unlimited:
      'Der Anbieter bezeichnet diesen Tarif als unbegrenzt. Prüfe Tarifname und Anbieterbedingungen auf Geschwindigkeitsbeschränkungen.',
    statusUnavailable:
      'SM-DP+-Status: Eine Online-Abfrage des SM-DP+-Status wird nicht unterstützt.',
    usageUnavailable: 'Nutzung prüfen: Online-Nutzungsabfragen werden nicht unterstützt.',
    usageContact:
      'Nutzung prüfen: Online-Abfragen werden nicht unterstützt. Wende dich für Nutzungsinformationen an den Online-Support.',
    validity15:
      'Gültigkeit: 15 Tage ab erster Nutzung. Sie beginnt bei Ankunft am Ziel und erster Nutzung mobiler Daten. Die Systemangabe „Activate Time“ zeigt nicht den tatsächlichen Zeitpunkt der ersten Nutzung.',
    refundInUse:
      'Erstattungsrichtlinie des Anbieters: Nach dem Kauf wechselt der eSIM-Status zu IN USE. Der Anbieter gewährt keine Erstattungen, auch nicht für ungenutzte eSIMs.',
    salesMinimum:
      'Verkaufsrichtlinie des Anbieters: Wiederverkäufer müssen einen Endkundenpreis von mindestens USD {amount} gemäß der Mindestpreisrichtlinie des Netzbetreibers sicherstellen; andernfalls kann der Weiterverkauf des Tarifs eingestellt werden.',
    refundPurchase:
      'Erstattungsrichtlinie des Anbieters: Nach dem Kauf unterstützt der Anbieter keine Erstattungen.',
    usageConsole:
      'Nutzung prüfen: Die Nutzungsabfrage-API wird noch nicht unterstützt. Aktualisiere die Anbieterkonsole, um die verbleibenden Daten in Echtzeit als Richtwert zu prüfen.',
  },
  dashboardUi: {
    ordersError: 'Deine Bestellungen konnten nicht geladen werden. Versuche es erneut.',
    actionError: 'Das hat nicht geklappt. Warte kurz und versuche es erneut.',
    opening: 'Dein Konto wird geöffnet…',
    greeting: 'Hallo, {name}.',
    traveller: 'Reisende',
    title: 'Jedes Abenteuer an einem Ort.',
    hint: 'Deine Tarife, Zahlungsstatus und eSIM-Installationsdaten.',
    signedOut: 'Du bist abgemeldet.',
    profileSyncError: 'Dein Profil konnte nicht synchronisiert werden. Versuche es erneut.',
    retryProfile: 'Profilsynchronisierung erneut versuchen',
    syncing: 'Dein Profil wird synchronisiert…',
    preview:
      'Melde dich an, um dein Konto zu verwalten. Es werden keine Beispielkäufe hinzugefügt.',
    signinHint: 'Melde dich an, um deine gekauften eSIMs zu sehen.',
    verifyBefore: 'Bestätige deine E-Mail, bevor du auf dein Konto zugreifst.',
    verifyInstruction: 'Öffne den Link in deiner Bestätigungs-E-Mail und prüfe erneut.',
    verified: 'Bestätigt',
    earlierEsims: 'Frühere bereite eSIMs',
    earlierOrders: 'Frühere Bestellungen',
    accountStatus: 'Kontostatus',
    checkEmail: 'E-Mail prüfen',
    guest: 'Gast',
    noEarlier: 'Keine früheren Bestellungen',
    ordersUnavailable: 'Bestellungen sind vorübergehend nicht verfügbar.',
    currentHint:
      'Deine aktuellen Käufe und Installationsdaten findest du unter Bestellungen und Meine eSIMs.',
    nextTrip: 'Meine nächste Reise planen',
    details: 'Kontodaten',
    nameSaved: 'Dein Name wurde aktualisiert.',
    saveName: 'Namen speichern',
    manageHint: 'Melde dich an, um dein Profil zu verwalten.',
    takeoff: 'Bereit zum Abheben?',
    installHint:
      'Prüfe dein Handy, installiere per WLAN und lies vor der Reise die Aktivierungsregeln deines Tarifs.',
    installHelp: 'Installationshilfe',
    usageDelay: 'Nutzungsdaten können ungefähr 2–3 Stunden verzögert sein.',
  },
  legacyOrder: {
    choose: 'Bestellung auswählen',
    chooseHint: 'Öffne eine Bestellung aus deinem Konto, um ihren Status zu sehen.',
    stripePending:
      'Stripe konnte noch nicht geprüft werden. Deine Zahlung wird möglicherweise noch verarbeitet.',
    delayed:
      'Deine Bestellung dauert länger als üblich. Aktualisiere den Status oder kontaktiere den Support, bevor du erneut bezahlst.',
    refunded:
      'Deine Zahlung wurde erstattet. Es kann dauern, bis deine Bank die Gutschrift anzeigt.',
    expired: 'Dieser Checkout ist ohne bestätigte Zahlung abgelaufen.',
    paymentPending:
      'Deine Zahlung wird geprüft und deine eSIM erscheint hier nach der Bereitstellung. Du kannst jederzeit zu dieser Seite zurückkehren.',
    testComplete: 'Testzahlung abgeschlossen',
  },
  orderUi: {
    paymentStatus: 'Zahlung: {status}',
    unitStatus: 'Status der eSIM: {status}',
    total: 'Gesamt: {amount}',
    pdfFontError: 'Die PDF-Schrift konnte nicht geladen werden. Versuche es erneut.',
    eyebrow: 'DEINE ALOZURI-BESTELLUNG',
    testOrder: 'Deine Testbestellung',
    readyTitle: 'Deine eSIM ist bereit.',
    onWayTitle: 'Deine eSIM ist unterwegs.',
    checkingTitle: 'Deine Zahlung wird geprüft',
    loadError:
      'Diese Bestellung konnte nicht geladen werden. Nutze den privaten E-Mail-Link oder melde dich mit der Zustelladresse an.',
    checkAgain: 'Erneut prüfen',
    signinPurchases: 'Zu deinen Käufen anmelden',
    privateLinkHint:
      'Öffne den privaten Bestelllink aus deiner E-Mail oder melde dich an, um deinen Kauf zu sehen.',
    confirming: 'Deine Bestellung wird bestätigt…',
    documents: 'Bestelldokumente',
    termsVersion: 'AGB-Version {version} · Akzeptiert am {date}',
    preparingPdf: 'PDF wird vorbereitet…',
    downloadPdf: 'Deinen Vertrag als PDF herunterladen',
    pdfPending: 'Die PDF ist nach bestätigter Zahlung verfügbar.',
    pdfError: 'Dein Vertrag konnte nicht heruntergeladen werden. Versuche es erneut.',
    testNotice: 'Stripe-Testbestellung. Keine echte Belastung und keine eSIM-Ausstellung.',
    supportNotice:
      'Deine Zahlung ist erfasst. Deine Bestellung benötigt Unterstützung, bevor wir deine eSIM vorbereiten können. Kontaktiere {support} mit deiner Bestellreferenz.',
    preparingNotice:
      'Deine eSIM wird vorbereitet. Diese private Seite aktualisiert sich, sobald die Installationsdaten bereit sind. Deine Bestätigungs-E-Mail enthält einen Link hierher und deinen Kaufvertrag.',
    deliveryIssue:
      'Die Zustellung erfordert Klärung. Kontaktiere den Support mit deiner Bestellreferenz.',
    refundNotice: 'Deine Erstattung wird bearbeitet.',
    refresh: 'Bestellstatus aktualisieren',
    guidance: 'Installationshilfe',
    title: 'Deine Bestellung',
    quantityAmount: 'Anzahl {quantity} · {amount}',
    purchasesError: 'Deine Käufe konnten nicht geladen werden. Versuche es später erneut.',
    accountEyebrow: 'DEIN ALOZURI',
    usageHint: 'Prüfe die Datennutzung jeder zugestellten eSIM.',
    historyHint: 'Deine Käufe und Installationsdaten an einem Ort.',
    loginHint:
      'Melde dich mit deiner bestätigten Zustell-E-Mail an, um deine Käufe zu finden. Gäste können auch den privaten Link aus ihrer Zustell-E-Mail nutzen.',
    retryPurchases: 'Käufe erneut laden',
    loadingPurchases: 'Käufe werden geladen…',
    empty: 'Noch keine Käufe',
    viewOrder: 'Bestellung und Installation ansehen',
    testNoUsage: 'Testbestellung. Keine eSIM-Nutzungsdaten verfügbar.',
    unitWaiting: 'eSIM-Status: {status}. Nutzung ist nach Zustellung verfügbar.',
    earlierAccount: 'Frühere Bestellungen und Kontoeinstellungen',
    cancelledUsage: 'Für diese stornierte oder erstattete eSIM ist die Nutzung nicht verfügbar.',
    supportUsage: 'Diese eSIM benötigt Support, bevor die Nutzung angezeigt werden kann.',
    preparingUsage: 'Deine eSIM wird vorbereitet. Nutzung ist nach Zustellung verfügbar.',
    emptyUsage: 'Noch keine eSIM mit Nutzungsdaten verfügbar',
    paidAllocating:
      'Deine bezahlte Bestellung wird vorbereitet. Deine eSIM erscheint hier nach der Zuweisung.',
    liveUsageOnly:
      'Nutzungsdaten sind für zugestellte eSIMs verfügbar. Testbestellungen enthalten keine echte eSIM.',
    viewOrders: 'Bestellungen ansehen',
  },
  usageUi: {
    error: 'Die Nutzung konnte nicht geprüft werden. Versuche es erneut.',
    checking: 'Datennutzung wird geprüft…',
    used: 'Verbrauchte Daten',
    remaining: 'Verbleibende Daten',
    total: 'Gesamtdatenvolumen',
    installation: 'Installation der eSIM',
    tran: 'eSIM-Tran-Nr.',
    supplierStatus: 'Anbieterstatus',
    expiry: 'Ablauf',
    notYet: 'Noch nicht gemeldet',
    nonFixed:
      'Dieser Tarif zeigt die vom Anbieter gemeldete Nutzung. Ein verbleibendes Highspeed-Guthaben wird hier nicht gemeldet.',
    lastChecked: 'Zuletzt geprüft: {date}',
    stale: 'Ein älterer Messwert wird angezeigt. Prüfe in Kürze erneut.',
    pending:
      'Die Nutzung wurde noch nicht gemeldet oder wird gerade geprüft. Versuche es in Kürze erneut.',
    unavailable: 'Die Nutzung ist vorübergehend nicht verfügbar. Versuche es später erneut.',
    delay:
      'Anbietermesswerte können sich um 2–3 Stunden verzögern. Tägliche und unbegrenzte Tarife haben eigene Volumen- und Fair-Use-Regeln.',
    refresh: 'Nutzung aktualisieren',
  },
  status: {
    preparing: 'In Vorbereitung',
    ready: 'Bereit',
    active: 'Aktiv',
    depleted: 'Daten aufgebraucht',
    expired: 'Abgelaufen',
    cancelled: 'Storniert',
    suspended: 'Gesperrt',
    revoked: 'Widerrufen',
    notReported: 'Nicht gemeldet',
    readyInstall: 'Bereit zur Installation',
    downloaded: 'Heruntergeladen; Installation nicht bestätigt',
    installed: 'Installiert',
    enabled: 'Installiert · aktiviert',
    disabled: 'Installiert · deaktiviert',
    deleted: 'Gelöscht',
    awaitingPayment: 'Zahlung ausstehend',
    processing: 'Zahlung wird verarbeitet',
    paid: 'Bezahlt',
    fulfilling: 'eSIM wird vorbereitet',
    deliveryIssue: 'Zustellung erfordert Klärung',
    refundPending: 'Erstattung wird bearbeitet',
    refunded: 'Erstattet',
    attention: 'Klärung erforderlich',
    failed: 'Zahlung fehlgeschlagen',
  },
  planInfo: {
    unavailable: 'Tarif nicht verfügbar',
    search: 'Tarife suchen',
    eyebrow: 'EIN TARIF. JEDER STOPP.',
    includes: 'Enthaltene Reiseziele: {count}.',
    know: 'Wichtig vor der Reise',
    activation: 'Aktivierung',
    networks: 'Netze',
    networkMissing: 'Für diesen Tarif wurden keine Netzinformationen bereitgestellt.',
    dataPolicy: 'Datenregelung',
    calls: 'Anrufe und SMS',
    callsText: 'Nur Daten. Behalte deine Heim-SIM für deine bestehende Nummer.',
    device: 'Gerätekompatibilität prüfen',
    conditions: 'Tarifbedingungen',
    rights: 'Deine gesetzlichen Rechte gelten weiterhin. Lies unsere {refunds}.',
    summary: 'TARIFÜBERSICHT',
    sample: 'BEISPIELTARIF',
    sampleNotice: 'Illustratives Beispiel. Dieser Tarif kann nicht gekauft werden.',
    adding: 'Wird hinzugefügt…',
    basket: 'Warenkorb wird vorbereitet…',
    retry: 'Preis erneut laden',
    added: 'Zum Warenkorb hinzugefügt.',
    viewCart: 'Warenkorb ansehen',
    limit: 'Warenkorblimit erreicht: fünf pro Tarif und zehn eSIMs pro Bestellung.',
    deviceNotice:
      'Dein Gerät muss eSIM unterstützen und ohne SIM-Lock sein. Installiere per WLAN und beachte die Aktivierungsregel.',
    refunds: 'Informationen zu Erstattungen',
    priceError: 'Der aktuelle Preis konnte nicht geladen werden. Versuche es erneut.',
    addError: 'Dieser Tarif konnte nicht hinzugefügt werden. Versuche es erneut.',
    localCoverage: 'Lokale Abdeckung',
    multiCoverage: 'Abdeckung mehrerer Länder',
  },
  authUi: {
    verifyEyebrow: 'E-MAIL BESTÄTIGEN',
    verifyTitle: 'Prüfe deinen Posteingang',
    verifyIntro:
      'Öffne die Bestätigungs-E-Mail an {email}. Bestätige deine E-Mail-Adresse, bevor du auf dein Konto zugreifst.',
    verifyDelay:
      'Wenn du dich gerade registriert hast, kann die E-Mail kurz dauern. Prüfe auch den Spamordner.',
    verifiedButton: 'Ich habe meine E-Mail bestätigt',
    resend: 'E-Mail erneut senden',
    another: 'Anderes Konto verwenden',
    verifyNotYet:
      'Deine E-Mail ist noch nicht bestätigt. Öffne den Bestätigungslink und prüfe erneut.',
    verifyCheckError: 'Die Bestätigung konnte nicht geprüft werden. Versuche es erneut.',
    verifySent: 'Bestätigungs-E-Mail gesendet. Prüfe Posteingang und Spamordner.',
    verifySendError: 'Die E-Mail konnte nicht gesendet werden. Warte kurz und versuche es erneut.',
    openingVerification: 'Bestätigung wird geöffnet…',
    registerTitle: 'Dein nächstes Abenteuer beginnt hier.',
    resetTitle: 'Ein neuer Anfang.',
    loginTitle: 'Willkommen zurück, Weltenbummler.',
    artEyebrow: 'DEINE WELT. VERNETZT.',
    artTitleA: 'Weniger WLAN suchen.',
    artTitleB: 'Mehr vor Ort erleben.',
    artFooter: 'Ein Konto. Jedes Abenteuer.',
    joinEyebrow: 'KOMM MIT AUF DIE REISE',
    resetEyebrow: 'PASSWORT ZURÜCKSETZEN',
    loginEyebrow: 'SCHÖN, DASS DU DA BIST',
    registerHint: 'Alle deine eSIMs, Tarife und Abenteuer an einem Ort.',
    resetHint: 'Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen.',
    loginHint: 'Melde dich an, finde deine eSIMs und mach dort weiter, wo du aufgehört hast.',
    ageNotice:
      'Konten und Käufe sind für Erwachsene ab 18 Jahren vorgesehen. Lies unsere {terms} und {privacy}. Eine Anmeldung ist keine Einwilligung in Marketing oder optionales Support-Tracking.',
    unconfigured:
      'Der Kontozugang ist vorübergehend nicht verfügbar. Du kannst dich inzwischen im Shop umsehen.',
    wait: 'Bitte warten…',
    google: 'Mit Google fortfahren',
    orEmail: 'oder mit E-Mail fortfahren',
    first: 'Vorname',
    last: 'Nachname',
    email: 'E-Mail-Adresse',
    password: 'Passwort',
    passwordHint: 'Mindestens 8 Zeichen',
    passwordPlaceholder: 'Dein Passwort',
    hide: 'Passwort verbergen',
    show: 'Passwort anzeigen',
    forgot: 'Passwort vergessen?',
    registerAgreement: 'Ich stimme den {terms} und der {privacy} zu.',
    create: 'Mein Konto erstellen',
    sendReset: 'Link zum Zurücksetzen senden',
    continueAccount: 'Weiter zu deinem Konto',
    newHere: 'Neu hier?',
    alreadyMember: 'Schon mit uns unterwegs?',
    backLogin: 'Zurück zur Anmeldung',
    secure: 'Dein nächstes Abenteuer, sicher verbunden.',
    resetSuccess:
      'Falls ein Konto mit dieser E-Mail-Adresse existiert, erhältst du einen Link zum Zurücksetzen des Passworts.',
    guestTitle: 'Oder als Gast bestellen',
    guestHint: 'Kein Konto nötig.',
    verifyNotice:
      'Du kannst jetzt bezahlen. {verify}, um deine Bestellungen unter Meine eSIMs zu sehen.',
    guestUnconfigured: 'Die Anmeldung ist hier nicht verfügbar. Du kannst als Gast fortfahren.',
    checkoutRegisterAgreement:
      'Mit dem Erstellen eines Kontos stimmst du unseren {terms} und unserer {privacy} zu. Konten sind für Erwachsene ab 18 Jahren.',
    createCheckout: 'Konto erstellen und im Checkout bleiben',
    loginCheckout: 'Anmelden und im Checkout bleiben',
    guestAlternative: 'Du kannst auch als Gast fortfahren.',
    passwordRequired: 'Gib dein Passwort ein.',
    passwordLength: 'Wähle ein Passwort mit mindestens 8 Zeichen.',
    checkingAccess: 'Kontozugang wird geprüft…',
    invalidCredential: 'Die E-Mail-Adresse oder das Passwort ist falsch.',
    invalidEmail: 'Gib eine gültige E-Mail-Adresse ein.',
    strongerPassword: 'Wähle ein stärkeres Passwort und versuche es erneut.',
    emailInUse:
      'Für diese E-Mail-Adresse besteht bereits ein Konto. Melde dich an oder setze dein Passwort zurück.',
    weakPassword: 'Bitte wähle ein Passwort mit mindestens acht Zeichen.',
    popupBlocked:
      'Dein Browser hat die Google-Anmeldung blockiert. Erlaube Pop-ups und versuche es erneut.',
    popupClosed: 'Die Google-Anmeldung wurde geschlossen. Versuche es erneut, wenn du bereit bist.',
    tooMany: 'Zu viele Versuche. Warte kurz und versuche es erneut.',
    unauthorizedDomain: 'Die Anmeldung ist für diese Domain noch nicht verfügbar.',
    methodDisabled: 'Diese Anmeldemethode ist noch nicht aktiviert.',
    authError: 'Anmeldung nicht möglich. Versuche es erneut.',
  },
  paymentUi: {
    declined: 'Deine Karte wurde abgelehnt. Versuche eine andere Zahlungsmethode.',
    policy:
      'Wenn du fortfährst, stimmst du unseren {terms} zu und bestätigst die Kenntnisnahme unserer {refunds} und {privacy}.',
    orCard: 'oder mit Karte bezahlen',
    formError:
      'Das Zahlungsformular konnte nicht geladen werden. Lade die Seite neu und versuche es erneut.',
    processing: 'Zahlung wird verarbeitet…',
    unavailable: 'Zahlungsformular nicht verfügbar',
    loadingPayment: 'Sichere Zahlung wird geladen…',
    loadingCheckout: 'Checkout wird geladen…',
    availabilityError: 'Die Zahlungsverfügbarkeit konnte nicht geprüft werden. Versuche es erneut.',
    planUnavailable: 'Dieser Tarif ist nicht verfügbar. Kehre zum Warenkorb zurück.',
    totalTimeout:
      'Die Bestätigung des Gesamtbetrags dauerte zu lange. Dein Warenkorb ist gespeichert. Versuche es erneut.',
    priceError: 'Preise konnten nicht geprüft werden.',
    startError: 'Checkout konnte nicht gestartet werden.',
    stripeError:
      'Stripe konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.',
    loadingPlan: 'Dein Tarif wird geladen…',
    preparing: 'Sichere Zahlung wird vorbereitet…',
    signingIn: 'Anmeldung wird abgeschlossen…',
    checkingAvailability: 'Zahlungsverfügbarkeit wird geprüft…',
    confirmingTotal: 'Gesamtbetrag wird bestätigt…',
    openingHint:
      'Deine Zahlungsoptionen werden geöffnet. Vor der Belastung kannst du die Zahlung prüfen.',
    signInHint: 'Schließe die Anmeldung ab, um fortzufahren. Deine Bestellung ist gespeichert.',
    confirmingHint:
      'Du kannst deine Daten eingeben, während wir die Bestellung bestätigen. Vor der Belastung kannst du die Zahlung prüfen.',
    syncHint: 'Behebe das Synchronisierungsproblem des Warenkorbs, bevor du zur Zahlung gehst.',
    totalHint: 'Dein Gesamtbetrag konnte nicht bestätigt werden. Versuche es unten erneut.',
    paymentsHint: 'Zahlungen sind derzeit nicht verfügbar. Dein Warenkorb ist gespeichert.',
    compatibilityHint: 'Bestätige oben, dass dein Gerät eSIM unterstützt, um fortzufahren.',
    editCart: 'Warenkorb bearbeiten',
    deliveryEmail: 'E-Mail für die Zustellung: {email}',
    testNotice: 'Testzahlung. Es wird weder echtes Geld belastet noch eine eSIM ausgestellt.',
    walletTimeout:
      'Die Wallet hat nicht geantwortet. Bezahle unten mit Karte. Deine bestehende Bestellung bleibt erhalten; dieser Wallet-Versuch hat keine Zahlung übermittelt.',
    syncingCart: 'Gespeicherter Warenkorb wird synchronisiert…',
    resolveCart: 'Kehre zum Warenkorb zurück und behebe dies vor der Zahlung.',
    promotionQuestion: 'Hast du einen Aktionscode?',
    promotionApplied:
      '{code}: {percent}% Rabatt · Nachlass {discount} · Ursprünglicher Gesamtbetrag {original}',
    compatible: 'Mein Gerät unterstützt eSIM und hat keinen SIM-Lock.',
    checkCompatibility: 'Kompatibilität prüfen',
    notConfigured:
      'Zahlungen sind für diesen Shop derzeit nicht eingerichtet. Dein Warenkorb ist gespeichert.',
    retry: 'Checkout erneut versuchen',
    walletFailed: 'Die Wallet hat nicht geantwortet. Bezahle stattdessen mit Karte.',
    detailsError: 'Prüfe deine Zahlungsdaten.',
    furtherAction: 'Für die Zahlung ist ein weiterer Schritt erforderlich. Versuche es erneut.',
  },
  cart: {
    activationLegacyNetwork:
      'Beginnt bei der ersten Verbindung mit einem unterstützten Netz. Prüfe deinen gekauften Tarif vor der Installation.',
    title: 'Dein Warenkorb',
    eyebrow: 'BEREIT FÜR DEINE NÄCHSTE REISE',
    orderTitle: 'DEINE BESTELLUNG',
    intro: '{count} × eSIM · Preise in {currency}',
    summaryLine: '{allowance} · {validity} · Anzahl {quantity}',
    activation: 'Aktivierung: {rule}',
    coverage: 'Abdeckung: {countries}',
    networks: 'Netze: {networks}',
    details: 'Tarifdetails',
    subtotal: 'Zwischensumme',
    total: 'Gesamt · {currency}',
    priceNote: 'Preise werden vor der Zahlung geprüft. Keine zusätzlichen Checkout-Gebühren.',
    confirming: 'Aktuelle Preise werden bestätigt…',
    security: 'Zahlungsdaten werden von Stripe sicher verarbeitet.',
    savedError: 'Der gespeicherte Warenkorb konnte nicht geladen werden. Versuche es erneut.',
    validationError: 'Der Warenkorb konnte nicht geprüft werden. Versuche es erneut.',
    loading: 'Dein Warenkorb wird geladen…',
    emptyTitle: 'Dein Warenkorb ist leer',
    emptyText: 'Entdecke eSIM-Tarife für dein nächstes Reiseziel.',
    useSaved: 'Gespeicherten Kontowarenkorb verwenden',
    explore: 'Reiseziele entdecken',
    unitPrice: '{amount} pro eSIM',
    unavailablePrice: 'Nicht verfügbar · letzter Preis:',
    quantity: 'Anzahl für {plan}',
    decrease: 'Anzahl für {plan} verringern',
    increase: 'Anzahl für {plan} erhöhen',
    remove: 'Entfernen',
    removeLabel: '{plan} entfernen',
    continueShopping: 'Weiter einkaufen',
    retryPrices: 'Preise erneut laden',
    saving: 'Dein Warenkorb wird gespeichert…',
    secureCheckout: 'Sicher zur Kasse',
    syncPending:
      'Die Bezahlung ist bereit, sobald dein gespeicherter Warenkorb synchronisiert wurde.',
    syncFailed: 'Behebe vor dem Fortfahren das oben genannte Synchronisierungsproblem.',
    removeUnavailable: 'Entferne nicht verfügbare Tarife, um zur Kasse zu gehen.',
    syncError:
      'Der Warenkorb konnte nicht synchronisiert werden. Versuche es erneut oder nutze deinen gespeicherten Kontowarenkorb.',
    activationNetwork: 'Beginnt bei der ersten Verbindung mit einem unterstützten Mobilfunknetz.',
    activationPurchase:
      'Die Gültigkeit beginnt nach dem Kauf. Kaufe erst, wenn du den Tarif nutzen möchtest.',
    activationInstall:
      'Die Gültigkeit beginnt mit der eSIM-Installation. Installiere sie erst, wenn du sie nutzen möchtest.',
    fairFixed: 'Festes Gesamtdatenvolumen. Nur Daten; keine lokale Telefonnummer.',
  },
  privacyUi: {
    chatFrame: 'Alozuri-Kundenchat',
    choices: 'Deine Datenschutzeinstellungen',
    banner:
      'Notwendiger Speicher ermöglicht Anmeldung, Warenkorb und Bezahlung. Der optionale Tawk.to-Chat und seine Dienstleister, einschließlich Cloudflare, bleiben deaktiviert, bis du zustimmst und den Chat öffnest. Die optionale Meta-Werbemessung bleibt bis zu deiner Zustimmung deaktiviert.',
    acceptAll: 'Alle akzeptieren',
    reject: 'Optionale ablehnen',
    customize: 'Auswahl anpassen',
    storageRefused:
      'Dein Browser hat diese Auswahl nicht gespeichert. Optionale Technologien bleiben deaktiviert; E-Mail-Support ist verfügbar.',
    storageFailed:
      'Einstellungen konnten nicht gespeichert werden. Optionale Technologien bleiben deaktiviert.',
    settingsHint:
      'Einkaufen und E-Mail-Support funktionieren ohne optionale Zustimmung. Du kannst deine Auswahl jederzeit ändern.',
    necessaryTitle: 'Notwendig — immer aktiv.',
    necessary:
      'Kontositzungen, Warenkorb, sicheres Bezahlen, gewählte Sprache und Währung sowie diese Datenschutzeinstellungen.',
    optionalSupportTitle: 'Optionaler Support — Tawk.to.',
    optionalSupport:
      'Erlaube den Livechat, wenn du ihn öffnest, einschließlich Serviceanalysen und Sicherheitstechnologien des Anbieters. Konto- oder Bestelldaten werden nicht automatisch an den Chat weitergegeben.',
    advertisingTitle: 'Optionale Werbung — Meta.',
    advertising: 'Werbung und Käufe mit Meta Pixel und der Messung bestätigter Käufe erfassen.',
    measurement:
      'Meta erfasst Seiten- und Tarifaufrufe, Checkout-Starts und bestätigte Käufe nur mit Werbeeinwilligung. Übermittelt werden Browser- und Ereigniskennungen, Kaufbetrag und Währung, keine Installationszugangsdaten.',
    inventory: 'Cookie-Verzeichnis lesen',
    save: 'Auswahl speichern',
    closeSettings: 'Einstellungen schließen',
    chat: 'Livechat',
    closeChat: 'Chat schließen',
    chatTitle: 'Mit Alozuri chatten',
    chatPrivacy:
      'Der Chat wird von Tawk.to bereitgestellt und kann dessen Cookies und Speicher nutzen. Aktiviere optionalen Support, um zu starten. Konto-, Bestell- und Installationsdaten geben wir nicht automatisch weiter.',
    enableChat: 'Chat aktivieren',
    preferEmail: 'Lieber per E-Mail?',
    privacyLink: 'Datenschutz- und Cookie-Auswahl',
    chatLoading: 'Chat lädt nicht?',
    emailUs: 'Schreib uns',
    contactTitle: 'Wähle deinen Kontaktweg',
    emailWithoutConsent: 'E-Mail-Support funktioniert ohne optionale Einwilligung.',
    openChat: 'Chat öffnen',
    chatSafety:
      'Am Desktop öffnet sich der Chat in einer Ecke, auf dem Handy im Vollbild. Sende keine Passwörter, vollständigen Kartendaten, QR-Codes oder Aktivierungsdaten. Die Verfügbarkeit von Mitarbeitenden ist nicht garantiert.',
  },
  display: {
    unlimited: 'Unbegrenzt',
    daily: '{size}/Tag',
    reduced: 'Unbegrenzt · {size}/Tag mit hoher Geschwindigkeit',
    featureTitle: 'Regionale und globale eSIMs entdecken',
    featureDescription: 'Vergleiche Datenvolumen und Abdeckung für deine nächste Reise.',
    featureRegionAllowance: 'Datenvolumen für {region}',
    featureView: 'Tarif ansehen: {region} {amount} GB',
    featureCoverage: 'Deckt {count} Länder ab',
    featureLoading: 'Aktuelle Tarife werden geladen…',
    featureUnavailable: 'Tarife derzeit nicht verfügbar',
    featureRetry: 'Schau später noch einmal vorbei.',
    featureError: 'Paketpreise sind vorübergehend nicht verfügbar. Versuche es später erneut.',
    europe: 'Europa',
    asia: 'Asien',
    northAmerica: 'Nordamerika',
    global: 'Weltweit',
    seasonal: 'Saisonale Reiseideen',
    photo: 'Reiseinspiration: {country}',
    installIntro:
      'Verbinde dich vor der Installation mit dem WLAN. Beachte die Aktivierungsregel deines Tarifs und behandle diese Angaben vertraulich.',
    installLoading: 'Installationsdaten werden geladen…',
    installShow: 'Installationsdaten anzeigen',
    installQr: 'Dein privater QR-Code zur eSIM-Installation',
    installInstructions:
      'Öffne auf deinem Handy Einstellungen → Mobilfunk → eSIM hinzufügen. Scanne den QR-Code von einem anderen Bildschirm oder gib die folgenden Angaben manuell ein.',
    smdp: 'SM-DP+-Adresse',
    activationCode: 'Aktivierungscode',
    confirmationCode: 'Bestätigungscode',
    installWarning:
      'Lösche die eSIM nach der Installation nur auf Anweisung des Supports. Manche Profile lassen sich nur einmal installieren.',
    installError:
      'Installationsdaten konnten nicht geladen werden. Versuche es erneut oder kontaktiere den Support mit deiner Bestellreferenz.',
  },
  search: {
    find: 'eSIM finden',
    multi: 'Mehrere Länder',
    multiTrip: 'Mehrländerreise',
    matcher: 'REISESUCHE',
    single: 'Ein Reiseziel',
    whereTrip: 'Welche Länder bereist du?',
    whereCountry: 'Wohin geht deine Reise?',
    tripHint: 'Füge jeden Stopp hinzu. Finde eine eSIM für alle Ziele.',
    countryHint: 'Finde einen Datentarif für dein nächstes Reiseziel.',
    covered: 'Jeder Stopp. Abgedeckt.',
    addAnother: 'Füge ein weiteres Ziel hinzu, um Mehrländertarife zu vergleichen.',
    chooseTwo: 'Wähle mindestens zwei Ziele für eine Mehrländerreise.',
    chooseOneNotice:
      'Wähle ein Land für die Einzelzielsuche. Deine Mehrländerroute bleibt gespeichert.',
    destinations: 'DEINE REISEZIELE',
    destination: 'DEIN REISEZIEL',
    remove: '{country} entfernen',
    add: 'Reiseziel hinzufügen',
    change: 'Reiseziel ändern',
    addStop: 'Stopp hinzufügen',
    choose: 'Reiseziel wählen',
    chooseCountry: 'Land wählen',
    searchCountries: 'Länder suchen',
    searchPlaceholder: 'Land suchen…',
    closeSearch: 'Ländersuche schließen',
    loadingDestinations: 'Reiseziele werden geladen…',
    noDestinations: 'Keine passenden Reiseziele.',
    allData: 'Alle Datentarife',
    minimumData: 'Mindestens {amount} GB',
    daily: 'Tarife mit täglichem Datenvolumen',
    unlimited: 'Unbegrenzt (Fair Use beachten)',
    finding: 'Deine Tarife werden gesucht…',
    coverageChecked: 'Abdeckung für jedes gewählte Land geprüft',
    demoNotice: 'Demo · Beispieltarife · Käufe deaktiviert',
    searching: 'Aktuelle Tarife werden gesucht…',
    refresh: 'Ergebnisse aktualisieren',
    matched: 'PASSEND ZU DEINER ROUTE',
    localResults: 'Lokale Tarife für {countries}: {count}.',
    tripResults: 'Tarife für die gesamte Route: {count}.',
    noAllowance: 'Kein Tarif mit diesem Datenvolumen',
    noLocal: 'Keine lokalen Tarife verfügbar',
    noCoverage: 'Kein Tarif deckt alle gewählten Länder ab',
    localExplanation: 'Diese Tarife gelten nur für dein ausgewähltes Land.',
    tripExplanation: 'Deckt alle ausgewählten Länder ab: {countries}.',
    mismatchExplanation:
      'Tarife für deine gewählten Ziele: {count}. Keiner entspricht dem gewählten Datenvolumen.',
    noLocalExplanation: 'Für dieses Land sind derzeit keine lokalen Tarife verfügbar.',
    noCoverageExplanation:
      'Derzeit deckt kein einzelner Tarif alle gewählten Länder ab. Versuche eine andere Kombination.',
    sort: 'Tarife sortieren',
    recommended: 'Empfohlenes Datenvolumen',
    value: 'Preis pro GB (festes Volumen)',
    price: 'Niedrigster Gesamtpreis',
    mostData: 'Meiste Daten',
    showAll: 'Alle Datentarife anzeigen',
    showing: '{shown} von {total} passenden Tarifen angezeigt',
    loadingMore: 'Weitere werden geladen…',
    showMore: 'Weitere Tarife anzeigen ({shown} von {total})',
    destinationsError:
      'Reiseziele konnten nicht geladen werden. Lade die Seite neu und versuche es erneut.',
    chooseTwoError: 'Füge für eine Mehrländersuche mindestens zwei Ziele hinzu.',
    chooseOneError: 'Wähle vor der Einzelzielsuche ein Land aus.',
    chooseFirstError: 'Füge mindestens ein Ziel hinzu, um deine eSIM zu finden.',
    searchError: 'Tarife konnten nicht gefunden werden. Versuche es erneut.',
    sampleCurrencyError: 'Beispieltarife sind nur in USD verfügbar.',
    bestValue: 'BESTER PREIS / GB',
    destinationsCount: '{count} Reiseziele',
    dataOnly: 'Nur Daten',
    samplePrice: 'Beispielpreis',
    coverage: 'Abgedeckte Reiseziele: {count}',
  },
  home: {
    heroTitleA: 'Eine eSIM.',
    heroTitleB: 'Jeder Zwischenstopp.',
    instant: 'Sofortige Bereitstellung',
    noRoaming: 'Keine Roaming-Überraschungen',
    tripConnected: 'DEINE REISE, VERNETZT',
    oneEsim: 'EINE eSIM',
    coversAll: 'Deckt alle ausgewählten Länder ab',
    onePlan: 'Ein Tarif über Ländergrenzen hinweg',
    noSim: 'Keine physische SIM wechseln',
    secure: 'Sicher bezahlen mit Stripe',
    compare: 'Reise-Datentarife vergleichen',
    dataNoDetours: 'Daten ohne Umwege',
    keepNumber: 'Deine Nummer bleibt',
    destinationsEyebrow: 'FINDE DEINE NÄCHSTE VERBINDUNG',
    destinationsTitle: 'Wohin geht’s als Nächstes?',
    destinationsDescription: 'Vom Wochenendtrip bis zur Reise, die du seit Jahren planst.',
    europeTitle: 'Frankreich, die Schweiz und Italien? Ja, alle drei.',
    europeDescription: 'Unsere Reisesuche prüft jedes Ziel für dich.',
    matchItinerary: 'Tarife für meine Route',
    stepsEyebrow: 'DREI SCHRITTE. EINE SORGE WENIGER.',
    stepsTitle: 'Verbunden, bevor du’s merkst.',
    checkDevice: 'Gerät prüfen',
    stepChooseTitle: 'Wähle deine Reiseziele',
    stepChooseText:
      'Füge alle Länder deiner Route hinzu. Vergleiche Tarife, die sämtliche Stopps abdecken.',
    stepInstallTitle: 'Installiere deine eSIM',
    stepInstallText:
      'Sobald deine eSIM bereit ist, findest du sie in deinem Konto. Scanne den QR-Code bei einer stabilen WLAN-Verbindung.',
    stepConnectTitle: 'Landen. Verbinden. Los.',
    stepConnectText:
      'Wähle die eSIM für mobile Daten und aktiviere ihr Datenroaming. Beachte die Aktivierungsregeln deines Tarifs.',
    faqEyebrow: 'VOR DER ABREISE',
    faqTitle: 'Gut zu wissen.',
    faqIntro: 'Bei Reisen gibt es genug zu organisieren. Deine Verbindung sollte einfach sein.',
    faqLink: 'Zum Hilfebereich',
    faqCoverageQuestion: 'Funktioniert eine eSIM in allen meinen Reiseländern?',
    faqCoverageAnswer:
      'Ja, wenn der Tarif alle ausgewählten Länder einschließt. Unsere Suche zeigt nur Tarife für deine gesamte Route. Die Schweiz und das Vereinigte Königreich werden einzeln geprüft: „Europa“ bedeutet bei uns nicht automatisch jedes europäische Land.',
    faqPhoneQuestion: 'Ist mein Handy kompatibel?',
    faqPhoneAnswer:
      'Dein Handy muss eSIM unterstützen und ohne SIM-Lock sein. Suche in den Mobilfunkeinstellungen nach „eSIM hinzufügen“ und bestätige vor dem Kauf beim Hersteller die Unterstützung deines genauen Modells und der Kaufregion.',
    faqNumberQuestion: 'Kann ich WhatsApp und meine Nummer behalten?',
    faqNumberAnswer:
      'Ja. Behalte deine bisherige SIM für Anrufe und deine gewohnte WhatsApp-Nummer. Wähle Alozuri für mobile Daten und deaktiviere Datenroaming für deine Heim-SIM, um Gebühren deines Anbieters zu vermeiden.',
    faqStartQuestion: 'Wann beginnt mein Tarif?',
    faqStartAnswer:
      'Das hängt vom Paket ab. Manche Tarife beginnen bei der Installation, andere bei der ersten Verbindung mit einem unterstützten Netz. Die Tarifdetails und die Installationsseite erläutern die Aktivierungsregel.',
    finalEyebrow: 'DEINE NÄCHSTE REISE, EINFACHER',
    finalTitle: 'Weniger Roaming. Mehr erleben.',
    finalText: 'Deine nächste Verbindung beginnt mit deinen Reisezielen.',
    findEsim: 'Meine eSIM finden',
  },
  site: {
    operations: 'Betrieb',
    cookieSettings: 'Cookie-Einstellungen',
    skip: 'Zum Inhalt springen',
    languageUnsupported: 'Diese Sprache wird nicht unterstützt.',
    languageLoadError: 'Die Sprache konnte nicht geladen werden. Bitte versuche es erneut.',
    languageSaveError:
      'Die Sprache wurde auf diesem Gerät geändert, aber die Einstellung konnte nicht in deinem Konto gespeichert werden.',
    home: 'Alozuri Startseite',
    mainNav: 'Hauptnavigation',
    currency: 'Währung',
    cartCount: '{count, plural, one {Warenkorb, # Artikel} other {Warenkorb, # Artikel}}',
    openMenu: 'Menü öffnen',
    closeMenu: 'Menü schließen',
    myAccount: 'Mein Konto',
    verifyEmail: 'E-Mail bestätigen',
    accountNav: 'Kontonavigation',
    myEsims: 'Meine eSIMs',
    usage: 'Datenverbrauch',
    orders: 'Bestellungen',
    settings: 'Kontoeinstellungen',
    loggingOut: 'Abmeldung läuft…',
    logoutError: 'Du konntest nicht abgemeldet werden. Bitte versuche es erneut.',
    explore: 'Entdecken',
    allDestinations: 'Alle Reiseziele',
    itinerary: 'Reiseroute zusammenstellen',
    europeEsims: 'Reise-eSIMs für Europa',
    guides: 'Ratgeber zu Reise-eSIMs',
    partners: 'Partner',
    legal: 'Rechtliches',
    support: 'Hilfe & Support',
    compatibility: 'eSIM-Kompatibilität & Installation',
    contact: 'Kontakt & Beschwerden',
    createAccount: 'Konto erstellen',
    sloganA: 'Weniger Roaming.',
    sloganB: 'Mehr entdecken.',
    office: 'Eingetragener Sitz',
    company:
      '{brand} ist ein Handelsname von {company}, einem in England und Wales unter der Nummer {number} eingetragenen Unternehmen.',
    copyright: '© {year} Alozuri. Für deine Reise gemacht.',
    acceptableUse: 'Zulässige Nutzung, Fair Use & Netzabdeckung',
  },
  common: {
    language: 'Sprache',
    loading: 'Wird geladen…',
    retry: 'Erneut versuchen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    back: 'Zurück',
    unavailableLanguage: 'Diese Sprache ist noch nicht verfügbar.',
  },
  navigation: {
    destinations: 'Reiseziele',
    howItWorks: 'So funktioniert es',
    help: 'Hilfe',
    login: 'Anmelden',
    signup: 'Registrieren',
    cart: 'Warenkorb',
    logout: 'Abmelden',
  },
  plans: {
    view: 'Tarif ansehen',
    add: 'In den Warenkorb',
    buy: 'Jetzt kaufen',
    loadingPrice: 'Preis wird geladen…',
    unavailable: 'Preis nicht verfügbar',
    allowance: 'Datenvolumen',
    validity: 'Gültigkeit',
    coverage: 'Abdeckung',
    days: '{count, plural, one {# Tag} other {# Tage}}',
  },
  checkout: {
    legalUnavailable:
      'Checkout und Bestelldokumente sind derzeit auf Englisch verfügbar. Wechsle zu Englisch, um fortzufahren. Dein Warenkorb und deine Währung bleiben erhalten.',
    useEnglish: 'Auf Englisch fortfahren',
    title: 'Zur Kasse',
    deliveryEmail: 'E-Mail für die Zustellung',
    emailHint: 'Wir senden die Installationsanleitung für deine eSIM an diese Adresse.',
    continue: 'Weiter zur Zahlung',
    securePayment: 'Sicher bezahlen',
    apply: 'Code einlösen',
    remove: 'Code entfernen',
    promotionalCode: 'Aktionscode',
    pay: '{amount} bezahlen',
  },
  errors: {
    catalogueChanged: 'Der Katalog wurde aktualisiert. Aktualisiere deine Suche.',
    searchPageInvalid: 'Diese Ergebnisseite ist nicht mehr gültig. Starte eine neue Suche.',
    generic: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    promoInvalid: 'Dieser Aktionscode ist ungültig.',
    promoExpired: 'Dieser Aktionscode ist abgelaufen.',
    authentication: 'Melde dich an, um fortzufahren.',
    planUnavailable: 'Dieser Tarif ist nicht mehr verfügbar.',
    paymentFailed: 'Die Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
    paymentCancelled: 'Die Zahlung wurde abgebrochen.',
    rateLimited: 'Zu viele Anfragen. Bitte warte kurz und versuche es erneut.',
  },
  account: {
    language: 'Bevorzugte Sprache',
    profile: 'Dein Profil',
    orders: 'Deine Bestellungen',
  },
  installation: {
    unitDetails: 'Installationsdetails für eSIM {number}',
    unitQr: 'Privater Installations-QR-Code für eSIM {number}',
    title: 'eSIM installieren',
    wifi: 'Verbinde dich vor der Installation mit einem WLAN.',
    private: 'Gib deine Installationsdaten nicht weiter.',
  },
  emails: {
    confirmationSubject: 'Bestätigung deiner Alozuri-eSIM-Bestellung',
    confirmed: 'Deine Bestellung ist bestätigt!',
    ready: 'Deine eSIM ist bereit zur Installation.',
    reference: 'Bestellnummer: {reference}',
  },
  legal: {
    terms: 'Allgemeine Geschäftsbedingungen',
    privacy: 'Datenschutzerklärung',
    cookies: 'Cookie-Richtlinie',
    refunds: 'Erstattungs- und Stornierungsbedingungen',
  },
} satisfies Messages;
