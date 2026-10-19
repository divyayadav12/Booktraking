const fs = require('fs');
const path = require('path');
const ExcelJS = require('./backend/node_modules/exceljs');

const bookTitleMap = {
  'AFON-002': 'AFM Outnotes Nov 26 Combined',
  'AFOS1-002': 'AFM OutScanner Nov26 Part 1',
  'AFOS2-002': 'AFM OutScanner Nov26 Part 2',
  'AFON-001': 'AFM Outnotes Concept Book',
  'AFOS1-001': 'AFM Outscanner Vol 1',
  'AFOS2-001': 'AFM Outscanner Vol 2',
  'FIDTHW-009': 'IDT Handwritten 9.0',
  'FIDTQB-009': 'IDT Question Bank 9.0',
  'FIDTQB-09': 'IDT Question Bank 9.0',
  'IAEBR-001': 'Inter Audit Brahmastra',
  'IAEQB-001': 'Inter Audit QB',
  'IAEDC-001': 'Inter audit DC',
  'ICHW-005': 'CA Inter Cost Handwritten V5',
  'ICQB-005': 'CA Inter Cost Question Bank V5 combined',
  'ICMCQ-005': 'CA Inter Cost Theory + MCQ',
  'IFMHW-005': 'CA Inter FM Handwritten V5',
  'IFMQB-005': 'CA Inter FM QB + MCQ V5',
  'ISMHW-005': 'CA Inter SM Concept Notes',
  'ISMQB-005': 'CA Inter SM QB',
  'AQB-001': 'Audit QB Jan26',
  'AMCQ-001': 'Audit MCQ',
  'AQB-002': 'Audit QB Nov26',
  'ACR-001': 'Audit crush Full Book',
  'ADC-001': 'Audit Drone Charts Full (270 Pg)',
  'IFMHW-002': 'CA Inter FM Handwritten Notes',
  'IFMQB-002': 'CA Inter FM QB Book',
  'ISMHW-002': 'CA Inter SM Handwritten Notes',
  'ISMQB-002': 'CA Inter SM QB Book',
  'DTSM-001': 'DT Study Material',
  'DTQB-001': 'DT Question Bank / ITT',
  'FRSV1-001': 'FR Solver Vol 1',
  'FRSV2-001': 'FR Solver Vol 2',
  'FRSS-001': 'FR Sure Shot Notes',
  'FRBR1-001': 'FR Brahmastra Vol 1',
  'FRBR2-001': 'FR Brahmastra Vol 2',
  'FRST1-001': 'Striker Vol 1',
  'FRST2-001': 'Striker Vol 2',
  'FRA-001': 'FR Aimer',
  'IGSHW-008': 'Inter IDT Handwritten Book 8.0',
  'IGSQB-008': 'Inter IDT QB Book 8.0',
  'IGSHW-001': 'Inter IDT Handwritten Book 8.0',
  'IGSQB-001': 'Inter IDT QB Book 8.0',
  'ICHW-002': 'CA Inter Cost Handwritten V2',
  'ICQB-002': 'CA Inter Cost QB V2',
  'ICMCQ-002': 'CA Inter Cost MCQ V2',
  'LAW': 'CA Law Notes'
};

function getBookTitle(code, courseName) {
  if (bookTitleMap[code]) return bookTitleMap[code];
  return `${courseName} - ${code}`;
}

// User's provided rows
const rawOrders = [
  {
    name: 'Yash Shrivas',
    course: 'CA Final AFM Exam Oriented Batch',
    pCode: 'AFMEO-002',
    pBooks: 'AFON-002, AFOS1-002, AFOS2-002',
    email: 'yashshrivas2711@gmail.com',
    mobile: '8412912076',
    address: '35, Saket nagar , Near depot wall, Post parvati nagar, Nagpur, MH - 440027'
  },
  {
    name: 'Komal Bansal',
    course: 'CA Final AFM Exam Oriented Batch',
    pCode: 'AFMEO-002',
    pBooks: 'AFON-002, AFOS1-002, AFOS2-002',
    email: 'komalbansal723@gmail.com',
    mobile: '8168025362',
    address: 'Near MCA College stadium road Charkhi dadri , Gali no. 4 Charkhi Dadri HARYANA - 127306'
  },
  {
    name: 'Ujjawal Kanthalia',
    course: 'CA Final AFM Exam Oriented Batch',
    pCode: 'AFMEO-002',
    pBooks: 'AFON-002, AFOS1-002, AFOS2-002',
    email: 'kanthaliaujjawal@gmail.com',
    mobile: '7339948064',
    address: 'B 1002 kpsj associate mondeal square near Prahlad Nagar garden sg highway Ahmedabad Gujarat - 380015'
  },
  {
    name: 'Sweta Saxena',
    course: 'CA Final AFM Regular Batch',
    pCode: 'AFMR-002',
    pBooks: 'AFON-002, AFOS1-002, AFOS2-002',
    email: 'aditisaxena2911@gmail.com',
    mobile: '7303846200',
    address: 'Vivek Vihar Phase I Vivek Vihar, D-230, second floor, block-D Delhi - 110095'
  },
  {
    name: 'VARUN GUPTA',
    course: 'CA Final IDT Safal Batch',
    pCode: 'IDTS-002',
    pBooks: 'FIDTHW-009, FIDTQB-009',
    email: 'varun16gupta03@gmail.com',
    mobile: '9873709814',
    address: '132 KITLRTI NAGAR, SECTOR 15, PART 1, NEAR RMS SENIOR SECONDARY SCHOOL, GURUGRAM, HARYANA - 122001'
  },
  {
    name: 'Siddhi gupta',
    course: 'CA Inter Auditing & Ethics Regular Batch',
    pCode: 'IAE-001',
    pBooks: 'IAEBR-001, IAEQB-001, IAEDC-001',
    email: 'siddhig3027@gmail.com',
    mobile: '9473927895',
    address: 'House No. 123 Shivnagar colony Naka ayodhya, Uttar pradesh - 224001'
  },
  {
    name: 'Arsh Malhotra',
    course: 'CA Inter COST Exam Oriented Batch',
    pCode: 'ICEO-002',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005',
    email: 'arshmalhotra2005@gmail.com',
    mobile: '9140606869',
    address: 'park view apartments, flat.106, patel nagar ,alambagh LUCKNOW UP - 226005'
  },
  {
    name: 'Kanchi Harwani',
    course: 'CA Inter COST Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005',
    email: 'kanchiharwani1@gmail.com',
    mobile: '8669025095',
    address: 'Soni vihar house no 2 near sewani maternity hospital, Bapu colony Amravati MH - 444606'
  },
  {
    name: 'Aditi Deshpande',
    course: 'CA Inter COST Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005',
    email: 'aditi.deshpande0203@gmail.com',
    mobile: '7821837581',
    address: 'D 803 Renuka Gloria Ravet, Near Ranjan heights Ravet MH - 412101'
  },
  {
    name: 'Aman Singh',
    course: 'CA Inter COST Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005',
    email: 'amanpoco528@gmail.com',
    mobile: '9142194681',
    address: 'Aklu chak, Mathiyapur, near Ram Devan Singh School Danapur BR - 801503'
  },
  {
    name: 'PRAVEEN CHOUDHARY',
    course: 'CA Inter COST Exam Oriented Upcoming Batch + CA Inter FM Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002 / IFMEO-002',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005, IFMHW-005, IFMQB-005',
    email: 'cneelam81102@gmail.com',
    mobile: '9462366225',
    address: 'Smart city housing board balotra, Near new flora kids school Balotra RJ - 344022'
  },
  {
    name: 'Sohan Taras',
    course: 'CA Inter COST Exam Oriented Upcoming Batch + CA Inter FM Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002 / IFMEO-002',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005, IFMHW-005, IFMQB-005',
    email: 'sohantaras18@gmail.com',
    mobile: '9112280018',
    address: 'Pune, A/P - Kiwale , Kotwal Nagar , Tal - Haveli , Dist - Pune - 412101'
  },
  {
    name: 'Zeeshan Ahmad',
    course: 'CA Inter COST Exam Oriented Upcoming Batch + CA Inter FM Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002 / IFMEO-002',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005, IFMHW-005, IFMQB-005',
    email: 'ahmadzeeshan700@gmail.com',
    mobile: '7007868294',
    address: '158/11C/1A RAJAPUR Landmark- DR Public School near Munna General Store PRAYAGRAJ UP - 211001'
  },
  {
    name: 'Aman Rai',
    course: 'CA Inter COST + FM + SM Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002 / IFMEO-002 / ISMEO-003',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005, IFMHW-005, IFMQB-005, ISMHW-005, ISMQB-005',
    email: 'amansrai10m@gmail.com',
    mobile: '7208123531',
    address: 'Kalamboli Panvel, room no-204 shidhivinayak orchid SECTOR-20, KALAMBOLI Panvel MH - 410218'
  },
  {
    name: 'Mukesh Kumar',
    course: 'CA Inter COST + FM + SM Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002 / IFMEO-002 / ISMEO-003',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005, IFMHW-005, IFMQB-005, ISMHW-005, ISMQB-005',
    email: 'mukeshk.jp@gmail.com',
    mobile: '9136566396',
    address: '523, Village- Nagla Motha, Post- Hatisa Bhagwantpur Hathras UP - 204101'
  },
  {
    name: 'Anil kumar',
    course: 'CA Inter COST + FM + SM Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002 / IFMEO-002 / ISMEO-003',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005, IFMHW-005, IFMQB-005, ISMHW-005, ISMQB-005',
    email: 'anilsunda023@gmail.com',
    mobile: '9050117758',
    address: 'bhuna,fatehabad, near by jai bharat library fatehabad HR - 125111'
  },
  {
    name: 'Manoj Singh Bisht',
    course: 'CA Inter COST + FM + SM Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002 / IFMEO-002 / ISMEO-003',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005, IFMHW-005, IFMQB-005, ISMHW-005, ISMQB-005',
    email: 'bishtmanoj815@gmail.com',
    mobile: '9560339982',
    address: 'Block 1 House No.174 Third Floor, Dakshin Puri , Dr. Ambedkar Nagar Near Deep Sweet , Virat Cinema DL - 110062'
  },
  {
    name: 'Kiran Roy',
    course: 'CA Inter COST + FM + SM Exam Oriented Upcoming Batch',
    pCode: 'ICEO-002 / IFMEO-002 / ISMEO-003',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005, IFMHW-005, IFMQB-005, ISMHW-005, ISMQB-005',
    email: 'kiranyadav766735@gmail.com',
    mobile: '9162310166',
    address: 'Jhingnagar near kali mandir Alinagar Road ,nalanada Bihar Sharif BR - 803101'
  },
  {
    name: 'Dev khadiya',
    course: 'CA Inter Cost Regular Batch',
    pCode: 'ICR-002',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005',
    email: 'khadiyadev@gmail.com',
    mobile: '7357863206',
    address: '145 ranapratap nagar indrapura jhotwara jaipur rajasthan - 302012'
  },
  {
    name: 'Kashish Biyani',
    course: 'CA Inter Cost Regular Batch',
    pCode: 'ICR-002',
    pBooks: 'ICHW-005, ICQB-005, ICMCQ-005',
    email: 'kashishbiyani7808@gmail.com',
    mobile: '7852048559',
    address: 'Flat no.101, Aashirwad Apartment, Infront of bajaj road samrat cinema, Sikar(Raj.) - 332001'
  },
  {
    name: 'devkaran devda',
    course: 'CA Inter FM Exam Oriented Upcoming Batch',
    pCode: 'IFMEO-002',
    pBooks: 'IFMHW-005, IFMQB-005',
    email: 'devkaran311203@gmail.com',
    mobile: '9530134168',
    address: 'House no. 50, samta nagar, shikarwadi, 80 feet road Chittorgarh RJ - 312001'
  },
  {
    name: 'Nancy Walia',
    course: 'CA Inter FM + SM Exam Oriented Upcoming Batch',
    pCode: 'IFMEO-002 / ISMEO-003',
    pBooks: 'IFMHW-005, IFMQB-005, ISMHW-005, ISMQB-005',
    email: 'nwalia215@gmail.com',
    mobile: '8427934770',
    address: 'New century enclave, near bedi chaki, Village duladi Nabha, Punjab - 147201'
  },
  {
    name: 'AMIT PANWAR',
    course: 'CA Inter FM + SM Exam Oriented Upcoming Batch',
    pCode: 'IFMEO-002 / ISMEO-003',
    pBooks: 'IFMHW-005, IFMQB-005, ISMHW-005, ISMQB-005',
    email: 'amitpanwar2124@gmail.com',
    mobile: '9882795555',
    address: 'PANWAR VILLA, DHARAMPUR COLONY, PINJORE, HARYANA - 134102'
  },
  {
    name: 'Sameer Ramesh Patil',
    course: 'CA Inter FM + SM Exam Oriented Upcoming Batch',
    pCode: 'IFMEO-002 / ISMEO-003',
    pBooks: 'IFMHW-005, IFMQB-005, ISMHW-005, ISMQB-005',
    email: 'srpatil20092002@gmail.com',
    mobile: '9579517031',
    address: '82, A, Aadarsh Colony Nakane Road, Deopur Dhule Maharashtra - 424002'
  },
  {
    name: 'Faisal Adeeb',
    course: 'CA Inter FM + SM Exam Oriented Upcoming Batch',
    pCode: 'IFMEO-002 / ISMEO-003',
    pBooks: 'IFMHW-005, IFMQB-005, ISMHW-005, ISMQB-005',
    email: 'fadeeb276@gmail.com',
    mobile: '8755094800',
    address: 'VM Hall Jubilee 3 AMU Campus, Jubilee hostel 3 Aligarh UP - 202001'
  },
  {
    name: 'Pradeep kumar Tupakula',
    course: 'AFM Outscanner Multi-Colour QB',
    pCode: 'AFBOS-02',
    pBooks: 'AFOS1-002, AFOS2-002',
    email: 'tupakulakumar218@gmail.com',
    mobile: '9121931592',
    address: '29/12, ground floor, opposit to printing press mjb street, triplicane Chennai Tamil Nadu - 600005'
  },
  {
    name: 'Archisman Basu',
    course: 'AFM Outscanner Multi-Colour QB',
    pCode: 'AFBOS-02',
    pBooks: 'AFOS1-002, AFOS2-002',
    email: 'archisman.basu27@gmail.com',
    mobile: '8961211349',
    address: 'Bose Medical, Aritrika, 22, Baishnabghata Patuli Township, Kendua, Patuli, Kolkata, WB - 700084'
  },
  {
    name: 'Rishu pratap Singh',
    course: 'Audit QB & MCQ Physical Book',
    pCode: 'ABQB-01',
    pBooks: 'AQB-001, AMCQ-001',
    email: 'rishu.singh.pratap@gmail.com',
    mobile: '9905569618',
    address: 'Gali no-4, Magadh colonty, nala par,kurji, Patna, Animalti Apartment Patna BR - 800010'
  },
  {
    name: 'Sparsh Gupta',
    course: 'CA Inter FM Full Book Set',
    pCode: 'IFMFL-002',
    pBooks: 'IFMHW-002, IFMQB-002',
    email: 'sparshgarg9871@gmail.com',
    mobile: '9311811194',
    address: 'A-81,sector-1 oakwood enclave wave city ghaziabad Near puja sthal Ghaziabad UP - 201001'
  },
  {
    name: 'Mukesh Kumar bind Bind',
    course: 'CA Inter FM Handwritten Notes',
    pCode: 'IFMHW-002',
    pBooks: 'IFMHW-002',
    email: 'mukeshbind1852001@gmail.com',
    mobile: '9820432706',
    address: 'Room no 2 vijay nagar mumbai chemburcam mahul road mumbai MH - 400074'
  },
  {
    name: 'Abhilakshit Tyagi',
    course: 'CA Inter SM Handwritten Notes',
    pCode: 'ISMHW-002',
    pBooks: 'ISMHW-002',
    email: 'tyagiabhilakshit@gmail.com',
    mobile: '8700432552',
    address: 'Tower 2, River heights, Rajnagar extension River Heights Road Ghaziabad UP - 201003'
  },
  {
    name: 'Deepak Pandian',
    course: 'CA Inter SM Handwritten Notes and QB',
    pCode: 'ISMFL-002',
    pBooks: 'ISMHW-002, ISMQB-002',
    email: 'ca.deepakpandian@gmail.com',
    mobile: '9884878125',
    address: 'Room no 306, Hotel Jaag 41, Periyar Rd, Porur Sundaram St, T Nagar Chennai Tamil Nadu - 600017'
  },
  {
    name: 'Ashok Malviya',
    course: 'DT Study Material',
    pCode: 'DTSM-001',
    pBooks: 'DTSM-001',
    email: 'malviyaashok671@gmail.com',
    mobile: '8451962915',
    address: 'Room no:918, A&O Titanic Tower (SRA) Devipada Borivali East Mumbai MH - 400066'
  },
  {
    name: 'Chandrika Kante',
    course: 'DT Study Material',
    pCode: 'DTSM-001',
    pBooks: 'DTSM-001',
    email: 'chandrikakante@gmail.com',
    mobile: '7386762427',
    address: 'Flat no:404, Saideep residence, street no:07, Road no 29, Alkapuri township, Manikonda Hyderabad TS - 500089'
  },
  {
    name: 'NAVEEN KUMAR AGRAWAL',
    course: 'FR Solver without Audio Video PODS',
    pCode: 'FRBSV-01',
    pBooks: 'FRSV1-001, FRSV2-001',
    email: 'agrawalniku15@gmail.com',
    mobile: '9001570321',
    address: 'Near Gopal ji ki murti khandela district sikar Rajasthan KHANDELA RJ - 332709'
  },
  {
    name: 'Ashish Garg',
    course: 'FR SureShot Notes',
    pCode: 'FRSS-001',
    pBooks: 'FRSS-001',
    email: 'gargashish803@gmail.com',
    mobile: '6395172057',
    address: '761 SOUTH BHOPA ROAD, PATEL NAGAR,NEW MANDI MUZAFFARNAGAR UP - 251001'
  },
  {
    name: 'Manish',
    course: 'IDT Full Book Set 9.0',
    pCode: 'IDTBFL-09',
    pBooks: 'FIDTHW-009, FIDTQB-009',
    email: 'mk215795@gmail.com',
    mobile: '9992792815',
    address: 'SNEHA GARMENTS Sector 45, Kanhai Village Gurugram HR - 122003'
  },
  {
    name: 'Abrar Chauhan',
    course: 'IDT Handwritten Book 9.0',
    pCode: 'FIDTHW-009',
    pBooks: 'FIDTHW-009',
    email: 'abrarchauhan9876@gmail.com',
    mobile: '9773124955',
    address: '401 4th floor b block Sahil apartment near madni masjid juhapura Ahmedabad GJ - 380055'
  },
  {
    name: 'Rajlaxmi singh',
    course: 'IDT Handwritten Book 9.0',
    pCode: 'FIDTHW-009',
    pBooks: 'FIDTHW-009',
    email: 'rlaxmi740477@gmail.com',
    mobile: '8429431269',
    address: 'shivpuram, mahila ITI College, Gora Bazaar, Raebareli UP - 229001'
  },
  {
    name: 'Shagun Gupta',
    course: 'IDT Handwritten Book 9.0',
    pCode: 'FIDTHW-009',
    pBooks: 'FIDTHW-009',
    email: 'gshagun412@gmail.com',
    mobile: '9057357781',
    address: 'P.no. 177 A1 jagnnath puri kanta chouraha Jhotwara jaipur RJ - 302012'
  },
  {
    name: 'Darshan Tated',
    course: 'IDT Handwritten Book 9.0',
    pCode: 'FIDTHW-009',
    pBooks: 'FIDTHW-009',
    email: 'darshantated12345@gmail.com',
    mobile: '9370807781',
    address: 'Jain boys hostel near Ahinsa Bhawan ,Itwari Nagpur Maharashtra - 440002'
  }
];

async function generateDispatchOrders() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Book Tracking Dispatch System';
  const ws = wb.addWorksheet('Dispatch Orders');

  ws.columns = [
    { header: 'Student Name', key: 'studentName', width: 24 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 16 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Tracking ID', key: 'trackingId', width: 16 },
    { header: 'Product Code', key: 'productCode', width: 22 },
    { header: 'Product Name', key: 'productName', width: 38 },
    { header: 'Book Code', key: 'bookCode', width: 18 },
    { header: 'Book Name', key: 'bookName', width: 42 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Delivery Address', key: 'address', width: 50 }
  ];

  // Header styling
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' } // Deep Royal Blue
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const datePrefix = `${dd}${mm}${yy}`; // e.g. 161026

  let orderSequence = 1;
  let totalBookItems = 0;

  for (let i = 0; i < rawOrders.length; i++) {
    const ord = rawOrders[i];
    // Barcode tracking ID as requested: DDMMYY001, DDMMYY002...
    const trackingId = `${datePrefix}${String(orderSequence).padStart(3, '0')}`;
    orderSequence++;

    // Split books in combo
    const books = ord.pBooks.split(',').map(b => b.trim()).filter(Boolean);
    const isMultiBook = books.length > 1;

    books.forEach((bCode) => {
      totalBookItems++;
      const row = ws.addRow({
        studentName: ord.name,
        mobileNumber: ord.mobile,
        email: ord.email,
        trackingId: trackingId,
        productCode: ord.pCode,
        productName: ord.course,
        bookCode: bCode,
        bookName: getBookTitle(bCode, ord.course),
        quantity: 1,
        address: ord.address
      });

      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 5, 6, 8, 10].includes(colNumber) ? 'left' : 'center'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        if (i % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        }
      });
    });
  }

  const dest1 = 'C:/Users/HP/Downloads/Real_Dispatch_Orders.xlsx';
  const dest2 = 'c:/Users/HP/Downloads/Book traking/Real_Dispatch_Orders.xlsx';
  await wb.xlsx.writeFile(dest1);
  await wb.xlsx.writeFile(dest2);
  console.log(`SUCCESS: Created ${rawOrders.length} student orders with ${totalBookItems} total books!`);
  console.log(`Saved at:\n1. ${dest1}\n2. ${dest2}`);
}

generateDispatchOrders().catch(console.error);
