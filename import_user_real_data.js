const mongoose = require('./backend/node_modules/mongoose');
const ExcelJS = require('./backend/node_modules/exceljs');
const path = require('path');
const fs = require('fs');

const rawCSV = `,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,
,,Trackon,,ADD. REQ,2026-08-10,,,,P_Type,Course,P_Code,p_Books,Name,Email,Mobile,Add1,Add2,PIN,City,State
1,L,Yash Shrivas,CA Final AFM Exam Oriented Batch,AFMEO-002,"AFON-002, AFOS1-002, AFOS2-002",1.989,08102026-1,08102026-1,L,CA Final AFM Exam Oriented Batch,AFMEO-002,"AFON-002, AFOS1-002, AFOS2-002",Yash Shrivas,yashshrivas2711@gmail.com,8412912076,"35, Saket nagar , Near depot wall, Post parvati nagar",,440027,Nagpur,MH
2,L,Komal Bansal,CA Final AFM Exam Oriented Batch,AFMEO-002,"AFON-002, AFOS1-002, AFOS2-002",1.989,,,L,CA Final AFM Exam Oriented Batch,AFMEO-002,"AFON-002, AFOS1-002, AFOS2-002",Komal Bansal,komalbansal723@gmail.com,8168025362,"Near MCA College stadium road Charkhi dadri , Gali no. 4 Charkhi Dadri HARYANA",,127306,Charkhi Dadri,HARYANA
3,L,Ujjawal Kanthalia,CA Final AFM Exam Oriented Batch,AFMEO-002,"AFON-002, AFOS1-002, AFOS2-002",1.989,,,L,CA Final AFM Exam Oriented Batch,AFMEO-002,"AFON-002, AFOS1-002, AFOS2-002",Ujjawal Kanthalia,kanthaliaujjawal@gmail.com,7339948064,"Ujjawal Kanthalia B 1002 kpsj associate mondeal square near Prahlad Nagar garden sg highway Ahmedabad Gujarat, B 1002 kpsj associate","Ahmedabad, Gujarat 380015 India",380015,Ahmedabad,Gujarat
4,L,Sweta Saxena,CA Final AFM Regular Batch,AFMR-002,"AFON-002, AFOS1-002, AFOS2-002",1.989,,,L,CA Final AFM Regular Batch,AFMR-002,"AFON-002, AFOS1-002, AFOS2-002",Sweta Saxena,aditisaxena2911@gmail.com,7303846200,"Vivek Vihar Phase I Vivek Vihar, D-230, second floor, block-D",,110095,Delhi,DL
5,L,VARUN GUPTA,CA Final IDT Safal Batch,IDTS-002,"FIDTHW-009, FIDTQB-009",1.945,,,L,CA Final IDT Safal Batch,IDTS-002,"FIDTHW-009, FIDTQB-009",VARUN GUPTA,varun16gupta03@gmail.com,9873709814,"VARUN GUPTA, 132 KITLRTI NAGAR, SECTOR 15, PART 1, NEAR RMS SENIOR SECONDARY SCHOOL,","GURUGRAM,",122001,GURUGRAM,HARYANA
6,L,Siddhi gupta,CA Inter Auditing & Ethics Regular Batch,IAE-001,"IAEBR-001, IAEQB-001, IAEDC-001",2.312,,,L,CA Inter Auditing & Ethics Regular Batch,IAE-001,"IAEBR-001, IAEQB-001, IAEDC-001",Siddhi gupta,siddhig3027@gmail.com,9473927895,House No. 123 Shivnagar colony Naka ayodhya,City : ayodhya . State : Uttar pradesh . Pincode : 224001,224001,ayodhya,Uttar pradesh
7,L,Arsh Malhotra,CA Inter COST Exam Oriented Batch,ICEO-002,"ICHW-005, ICQB-005, ICMCQ-005",1.773,,,L,CA Inter COST Exam Oriented Batch,ICEO-002,"ICHW-005, ICQB-005, ICMCQ-005",Arsh Malhotra,arshmalhotra2005@gmail.com,9140606869,"park view apartments, flat.106, patel nagar ,alambagh",,226005,LUCKNOW,UP
8,L,Kanchi Harwani,CA Inter COST Exam Oriented Upcoming Batch,ICEO-002,"ICHW-005, ICQB-005, ICMCQ-005",1.773,,,L,CA Inter COST Exam Oriented Upcoming Batch,ICEO-002,"ICHW-005, ICQB-005, ICMCQ-005",Kanchi Harwani,kanchiharwani1@gmail.com,8669025095,"Soni vihar house no 2 near sewani maternity hospital, Bapu colony",,444606,Amravati,MH
9,L,Aditi Deshpande,CA Inter COST Exam Oriented Upcoming Batch,ICEO-002,"ICHW-005, ICQB-005, ICMCQ-005",1.773,,,L,CA Inter COST Exam Oriented Upcoming Batch,ICEO-002,"ICHW-005, ICQB-005, ICMCQ-005",Aditi Deshpande,aditi.deshpande0203@gmail.com,7821837581,"D 803 Renuka Gloria Ravet, Near Ranjan heights",,412101,Ravet,MH
10,L,Aman Singh,CA Inter COST Exam Oriented Upcoming Batch,ICEO-002,"ICHW-005, ICQB-005, ICMCQ-005",1.773,,,L,CA Inter COST Exam Oriented Upcoming Batch,ICEO-002,"ICHW-005, ICQB-005, ICMCQ-005",Aman Singh,amanpoco528@gmail.com,9142194681,"Aklu chak, Mathiyapur, near Ram Devan Singh School",,801503,Danapur,BR
11,L,PRAVEEN CHOUDHARY,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005",3.019,,,L,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005",PRAVEEN CHOUDHARY,cneelam81102@gmail.com,9462366225,"Smart city housing board balotra, Near new flora kids school",,344022,Balotra,RJ
12,L,Sohan Taras,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005",3.019,,,L,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005",Sohan Taras,sohantaras18@gmail.com,9112280018,"Pune, A/P - Kiwale , Kotwal Nagar , Tal - Haveli , Dist - Pune",,412101,Pune,MH
13,L,Zeeshan Ahmad,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005",3.019,,,L,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005",Zeeshan Ahmad,ahmadzeeshan700@gmail.com,7007868294,158/11C/1A RAJAPUR Landmark- DR Public School near Munna General Store,,211001,PRAYAGRAJ,UP
14,L,Aman Rai,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002
ISMEO-003","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",3.622,,,L,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002
ISMEO-003","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",Aman Rai,amansrai10m@gmail.com,7208123531,"Kalamboli Panvel, room no-204 shidhivinayak orchid SECTOR-20, KALAMBOLI",,410218,Panvel,MH
15,L,Mukesh Kumar,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002
ISMEO-003","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",3.622,,,L,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002
ISMEO-003","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",Mukesh Kumar,mukeshk.jp@gmail.com,9136566396,"523, Village- Nagla Motha, Post- Hatisa Bhagwantpur, Hathras-204101",,204101,Hathras,UP
16,L,Anil kumar,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002
ISMEO-003","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",3.622,,,L,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002
ISMEO-003","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",Anil kumar,anilsunda023@gmail.com,9050117758,"bhuna,fatehabad, near by jai bharat library",,125111,fatehabad,HR
17,L,Manoj Singh Bisht,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002
ISMEO-003","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",3.622,,,L,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002
ISMEO-003","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",Manoj Singh Bisht,bishtmanoj815@gmail.com,9560339982,"Block 1 House No.174 Third Floor, Dakshin Puri , Dr. Ambedkar Nagar Near Deep Sweet , Virat Cinema",,110062,DR AMBEDKAR NAGAR,DL
18,L,Kiran Roy,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002
ISMEO-003","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",3.622,,,L,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002
ISMEO-003","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",Kiran Roy,kiranyadav766735@gmail.com,9162310166,"Jhingnagar near kali mandir Alinagar Road ,nalanada",,803101,Bihar Sharif,BR
19,L,Dev khadiya,CA Inter Cost Regular Batch,ICR-002,"ICHW-005, ICQB-005, ICMCQ-005",1.773,,,L,CA Inter Cost Regular Batch,ICR-002,"ICHW-005, ICQB-005, ICMCQ-005",Dev khadiya,khadiyadev@gmail.com,7357863206,"145 ranapratap nagar indrapura jhotwara jaipur rajasthan, 145",,302012,Jaipur,RJ
20,L,Kashish Biyani,CA Inter Cost Regular Batch,ICR-002,"ICHW-005, ICQB-005, ICMCQ-005",1.773,,,L,CA Inter Cost Regular Batch,ICR-002,"ICHW-005, ICQB-005, ICMCQ-005",Kashish Biyani,kashishbiyani7808@gmail.com,7852048559,"Flat no.101, Aashirwad Apartment, Infront of bajaj road samrat cinema, Sikar(Raj.) Landmark - Near Om Hospital City- Sikar",,332001,Sikar,Rajasthan
21,L,devkaran devda,CA Inter FM Exam Oriented Upcoming Batch,IFMEO-002,"IFMHW-005, IFMQB-005",1.264,,,L,CA Inter FM Exam Oriented Upcoming Batch,IFMEO-002,"IFMHW-005, IFMQB-005",devkaran devda,devkaran311203@gmail.com,9530134168,"House no. 50, samta nagar, shikarwadi, 80 feet road",,312001,Chittorgarh,RJ
22,L,Nancy Walia,"CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","IFMEO-002
ISMEO-003","IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",1.901,,,L,"CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","IFMEO-002
ISMEO-003","IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",Nancy Walia,nwalia215@gmail.com,8427934770,"Nancy Walia New century enclave, near bedi chaki, Village duladi","Nabha, Punjab",147201,Nabha,Punjab
23,L,AMIT PANWAR,"CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","IFMEO-002
ISMEO-003","IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",1.901,,,L,"CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","IFMEO-002
ISMEO-003","IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",AMIT PANWAR,amitpanwar2124@gmail.com,9882795555,"AMIT PANWAR, PANWAR VILLA, DHARAMPUR COLONY,","PINJORE,",134102,PINJORE,HARYANA
24,L,Sameer Ramesh Patil,"CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","IFMEO-002
ISMEO-003","IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",1.901,,,L,"CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","IFMEO-002
ISMEO-003","IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",Sameer Ramesh Patil,srpatil20092002@gmail.com,9579517031,"82, A, Aadarsh Colony Nakane Road, Deopur Dhule",,424002,Dhule,Maharashtra
25,L,Faisal Adeeb,"CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","IFMEO-002
ISMEO-003","IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",1.901,,,L,"CA Inter FM Exam Oriented Upcoming Batch
CA Inter SM Exam Oriented Upcoming Batch","IFMEO-002
ISMEO-003","IFMHW-005, IFMQB-005
ISMHW-005, ISMQB-005",Faisal Adeeb,fadeeb276@gmail.com,8755094800,"VM Hall Jubilee 3 AMU Campus, Jubilee hostel 3",,202001,Aligarh,UP
26,B,Pradeep kumar Tupakula,AFM Outscanner Multi-Colour QB,AFBOS-02,"AFOS1-002, AFOS2-002",1.243,,,B,AFM Outscanner Multi-Colour QB,AFBOS-02,"AFOS1-002, AFOS2-002",Pradeep kumar Tupakula,tupakulakumar218@gmail.com,9121931592,"29/12, ground floor,","opposit to printing press mjb street, triplicane",600005,Chennai,Tamil Nadu
27,B,Archisman Basu,AFM Outscanner Multi-Colour QB,AFBOS-02,"AFOS1-002, AFOS2-002",1.243,,,B,AFM Outscanner Multi-Colour QB,AFBOS-02,"AFOS1-002, AFOS2-002",Archisman Basu,archisman.basu27@gmail.com,8961211349,"Bose Medical, Aritrika, 22, Baishnabghata Patuli Township, Kendua, Patuli, Kolkata,",,700084,Kolkata,WB
28,B,Rishu pratap Singh,Audit QB & MCQ Physical Book,ABQB-01,"AQB-001, AMCQ-001",1.815,,,B,Audit QB & MCQ Physical Book,ABQB-01,"AQB-001, AMCQ-001",Rishu pratap Singh,rishu.singh.pratap@gmail.com,9905569618,"Gali no-4, Magadh colonty, nala par,kurji, Patna, Animalti Apartment",,800010,Patna,BR
29,B,Dr. Sandeep Trivedi,BOOKS,,,1.299,,,B,BOOKS,,,Dr. Sandeep Trivedi,, 7000688958,"Sunrise marketing, Near old R P high school","Civil line road, Agara mohhala, Panna",488001,Panna,MP
30,B,Sparsh Gupta,CA Inter FM Full Book Set,IFMFL-002,"IFMHW-002, IFMQB-002",1.264,,,B,CA Inter FM Full Book Set,IFMFL-002,"IFMHW-002, IFMQB-002",Sparsh Gupta,sparshgarg9871@gmail.com,9311811194,"A-81,sector-1 oakwood enclave",wave city ghaziabad Near puja sthal,201001,Ghaziabad,Uttar Pradesh
31,B,Mukesh Kumar bind Bind,CA Inter FM Handwritten Notes,IFMHW-002,IFMHW-002,0.22,,,B,CA Inter FM Handwritten Notes,IFMHW-002,IFMHW-002,Mukesh Kumar bind Bind,mukeshbind1852001@gmail.com,9820432706,Room no 2 vijay nagar mumbai,chemburcam mahul road mumbai,400074,Mumbai,MH
32,B,Abhilakshit Tyagi,CA Inter SM Handwritten Notes,ISMHW-002,ISMHW-002,0.27,,,B,CA Inter SM Handwritten Notes,ISMHW-002,ISMHW-002,Abhilakshit Tyagi,tyagiabhilakshit@gmail.com,8700432552,"Abhilakshit Tyagi Tower 2, River heights, Rajnagar extension River Heights Road Sehani Khurd Raj Nagar Extension, 3B 507, tower 2 Ghaziabad, Uttar Pradesh 201003 India",,201003,Ghaziabad,UP
33,B,Deepak Pandian,CA Inter SM Handwritten Notes and QB,ISMFL-002,"ISMHW-002, ISMQB-002",0.664,,,B,CA Inter SM Handwritten Notes and QB,ISMFL-002,"ISMHW-002, ISMQB-002",Deepak Pandian,ca.deepakpandian@gmail.com,9884878125,"Room no 306, Hotel Jaag","41, Periyar Rd, Porur Sundaram St, T Nagar",600017,Chennai,Tamil Nadu
34,B,Ashok Malviya,DT Study Material,DTSM-001,DTSM-001,0.733,,,B,DT Study Material,DTSM-001,DTSM-001,Ashok Malviya,malviyaashok671@gmail.com,8451962915,"Room no:918, A&O Titanic Tower (SRA) Devipada Borivali East",,400066,Mumbai,MH
35,B,Chandrika Kante,DT Study Material,DTSM-001,DTSM-001,0.733,,,B,DT Study Material,DTSM-001,DTSM-001,Chandrika Kante,chandrikakante@gmail.com,7386762427,"Flat no:404, Saideep residence, street no:07, Road no 29, Alkapuri township, Manikonda,",,500089,Hyderabad,TS
36,B,NAVEEN KUMAR AGRAWAL,FR Solver without Audio Video PODS,FRBSV-01,"FRSV1-001, FRSV2-001",1.879,,,B,FR Solver without Audio Video PODS,FRBSV-01,"FRSV1-001, FRSV2-001",NAVEEN KUMAR AGRAWAL,agrawalniku15@gmail.com,9001570321,Near Gopal ji ki murti khandela district sikar Rajasthan,,332709,KHANDELA,RJ
37,B,Ashish Garg,FR SureShot Notes,FRSS-001,FRSS-001,0.64,,,B,FR SureShot Notes,FRSS-001,FRSS-001,Ashish Garg,gargashish803@gmail.com,6395172057,"761' SOUTH BHOPA ROAD, PATEL NAGAR,NEW MANDI","Near HEAD POST OFFICE, PATEL NAGAR KI RAMLILA,RAJPUT HALWAI KBSAAMNE",251001,MUZAFFARNAGAR,UP
38,B,Manish,IDT Full Book Set 9.0,IDTBFL-09,"FIDTHW-009, FIDTQB-009",1.945,,,B,IDT Full Book Set 9.0,IDTBFL-09,"FIDTHW-009, FIDTQB-009",Manish,mk215795@gmail.com,9992792815,"SNEHA GARMENTS Sector 45, Kanhai Village",,122003,Gurugram,HR
39,B,Abrar Chauhan,IDT Handwritten Book 9.0,FIDTHW-009,FIDTHW-009,0.919,,,B,IDT Handwritten Book 9.0,FIDTHW-009,FIDTHW-009,Abrar Chauhan,abrarchauhan9876@gmail.com,9773124955,401 4th floor b block,Sahil apartment near madni masjid juhapura,380055,Ahmedabad,GJ
40,B,Rajlaxmi singh,IDT Handwritten Book 9.0,FIDTHW-009,FIDTHW-009,0.919,,,B,IDT Handwritten Book 9.0,FIDTHW-009,FIDTHW-009,Rajlaxmi singh,rlaxmi740477@gmail.com,8429431269,"shivpuram, mahila ITI College, Gora Bazaar, Raebareli",,229001,Raebareli,UP
41,B,Shagun Gupta,IDT Handwritten Book 9.0,FIDTHW-009,FIDTHW-009,0.919,,,B,IDT Handwritten Book 9.0,FIDTHW-009,FIDTHW-009,Shagun Gupta,gshagun412@gmail.com,9057357781,"P.no. 177 A1 jagnnath puri kanta chouraha Jhotwara jaipur, Pehlwan ji ki gali near A TO Z library",,302012,Jaipur,RJ
42,B,Darshan Tated,IDT Handwritten Book 9.0,FIDTHW-009,FIDTHW-009,0.919,,,B,IDT Handwritten Book 9.0,FIDTHW-009,FIDTHW-009,Darshan Tated,darshantated12345@gmail.com,9370807781,"Jain boys hostel near Ahinsa Bhawan ,Itwari",,440002,Nagpur,Maharashtra
,,,,,,,,,,,,,,,,,,,,
S.P.,L,Panchami Joishy,CA Final AFM Exam Oriented Batch,AFMEO-002,"AFON-002, AFOS1-002, AFOS2-002",1.989,,,L,CA Final AFM Exam Oriented Batch,AFMEO-002,"AFON-002, AFOS1-002, AFOS2-002",Panchami Joishy,PanchamijoihsyCAFINAL@outlook.com,9880520210,"Vasudha , Door No, Gandhi Maidhan Road",,574104,Karkala,KA
S.P.,L,SNEHA P,CA Final AFM Full English Regular Batch,AFMFE-001,"AFON-001, AFOS1-001, AFOS2-001",1.92,,,L,CA Final AFM Full English Regular Batch,AFMFE-001,"AFON-001, AFOS1-001, AFOS2-001",SNEHA P,casnehaaap@gmail.com,7560807369,"Pathanadukkam house,Kottoor PO, Muliyar via",,671542,kasaragode,KL
S.P.,L,Pritam Chakraborty,CA Final AFM Regular Batch,AFMR-002,"AFON-002, AFOS1-002, AFOS2-002",1.989,,,L,CA Final AFM Regular Batch,AFMR-002,"AFON-002, AFOS1-002, AFOS2-002",Pritam Chakraborty,pritamchakraborty464@gmail.com,9875463610,"118,Balitikuri Sadananda Smriti path (Near Muktaram Dey High School).Howrah House no. 60",,711113,HOWRAH,WB
S.P.,L,Sneha gupta,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005",3.019,,,L,"CA Inter COST Exam Oriented Upcoming Batch
CA Inter FM Exam Oriented Upcoming Batch","ICEO-002
IFMEO-002","ICHW-005, ICQB-005, ICMCQ-005
IFMHW-005, IFMQB-005",Sneha gupta,sg5695738@gmail.com,9302065965,"Ward no. 6 near shree ram tower baniya para joura, Swara sareee colllection wali gully",,476221,Joura,MP
S.P.,B,Anusuya Devi,AFM Outscanner Multi-Colour QB,AFBOS-02,"AFOS1-002, AFOS2-002",1.243,,,B,AFM Outscanner Multi-Colour QB,AFBOS-02,"AFOS1-002, AFOS2-002",Anusuya Devi,ammugayathri124@gmail.com,9361053156,"6/1,VNR nagar ,4 th Street Virudhachalam Cuddalore district,",,606001,Virudhachalam,TN
S.P.,B,Arsha Malayamkulatheyil,Audit Full Book Set,ABFL-01,"ACR-001, AQB-002, AMCQ-001",2.759,,,B,Audit Full Book Set,ABFL-01,"ACR-001, AQB-002, AMCQ-001",Arsha Malayamkulatheyil,arsha.jm96@gmail.com,8157964312,"Malayamkulatheyil House, Maranchery Post ( Near Azhar School ) Malappuram District",,679581,Malappuram District,KL
S.P.,B,Sreekala Mupparaju,Audit Full Book Set,ABFL-01,"ACR-001, AQB-002, AMCQ-001",2.759,,,B,Audit Full Book Set,ABFL-01,"ACR-001, AQB-002, AMCQ-001",Sreekala Mupparaju,sreekalam454@gmail.com,8790903476,"Flat no:304, Shivaana apartments, Sai vilas colony, Ameenpur",,502032,Hyderabad,TS
S.P.,B,Ashok kumar M,DT Study Material,DTSM-001,DTSM-001,0.733,,,B,DT Study Material,DTSM-001,DTSM-001,Ashok kumar M,caashok.nms@gmail.com,8190001056,"SF 588/2B, Steel Mart, kariyampalayam pirivu, Annur",,641697,Coimbatore,TN`;

// Helper: Parse CSV accounting for quoted newlines and commas
function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let curVal = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        curVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(curVal.trim());
      curVal = '';
    } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(curVal.trim());
      lines.push(row);
      row = [];
      curVal = '';
    } else {
      curVal += ch;
    }
  }

  if (curVal || row.length > 0) {
    row.push(curVal.trim());
    lines.push(row);
  }

  return lines;
}

// Generate human-friendly title from book code
function getBookTitle(code, courseName) {
  const map = {
    'AFON-002': 'CA Final AFM Notes Vol 2',
    'AFOS1-002': 'AFM Outscanner Question Bank Part 1',
    'AFOS2-002': 'AFM Outscanner Question Bank Part 2',
    'AFON-001': 'CA Final AFM Notes Vol 1 (English)',
    'AFOS1-001': 'AFM Outscanner Question Bank Part 1 (English)',
    'AFOS2-001': 'AFM Outscanner Question Bank Part 2 (English)',
    'FIDTHW-009': 'IDT Handwritten Book Edition 9.0',
    'FIDTQB-009': 'IDT Question Bank Edition 9.0',
    'IAEBR-001': 'CA Inter Auditing & Ethics Regular Book',
    'IAEQB-001': 'CA Inter Auditing & Ethics Question Bank',
    'IAEDC-001': 'CA Inter Auditing Daily Capsule',
    'ICHW-005': 'CA Inter Cost Handwritten Notes',
    'ICQB-005': 'CA Inter Cost Question Bank',
    'ICMCQ-005': 'CA Inter Cost MCQ Book',
    'IFMHW-005': 'CA Inter FM Handwritten Notes',
    'IFMQB-005': 'CA Inter FM Question Bank',
    'ISMHW-005': 'CA Inter SM Handwritten Notes',
    'ISMQB-005': 'CA Inter SM Question Bank',
    'IFMHW-002': 'CA Inter FM Handwritten Notes V2',
    'IFMQB-002': 'CA Inter FM Question Bank V2',
    'ISMHW-002': 'CA Inter SM Handwritten Notes V2',
    'ISMQB-002': 'CA Inter SM Question Bank V2',
    'AQB-001': 'Audit Question Bank Part 1',
    'AMCQ-001': 'Audit MCQ Practice Book',
    'AQB-002': 'Audit Question Bank Part 2',
    'ACR-001': 'Audit Core Review Book',
    'DTSM-001': 'Direct Tax Study Material',
    'FRSV1-001': 'FR Solver Volume 1',
    'FRSV2-001': 'FR Solver Volume 2',
    'FRSS-001': 'FR SureShot Summary Notes',
  };
  return map[code] || `${courseName} - ${code}`;
}

async function run() {
  console.log('1. Parsing Real Data...');
  const parsedRows = parseCSV(rawCSV);

  // Filter out blank rows and header row
  const dataRows = parsedRows.filter((r) => {
    if (!r || r.length < 5) return false;
    const firstCol = r[0] || '';
    if (firstCol === '' && !r[2]) return false;
    if (r[2] === 'Trackon' || r[2] === 'Name' || r[3] === 'Course') return false;
    return !!(r[2] || r[13]);
  });

  console.log(`Found ${dataRows.length} valid student rows in provided data.`);

  const excelRows = [];
  let seqCounter = 1;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const r = dataRows[idx];
    const studentName = r[13] || r[2] || 'Student';
    const email = r[14] || null;
    let mobile = (r[15] || '').replace(/[^0-9]/g, '');
    if (!mobile || mobile.length < 10) mobile = '9876543210';
    if (mobile.length === 10) mobile = '+91' + mobile;
    else if (!mobile.startsWith('+')) mobile = '+' + mobile;

    let trackingId = r[7] || r[8];
    if (!trackingId || trackingId.trim() === '') {
      trackingId = `TRK-081026-${String(seqCounter).padStart(3, '0')}`;
    }
    seqCounter++;

    const rawCourse = r[10] || r[3] || 'Course';
    const rawPCode = r[11] || r[4] || 'PRD-01';
    const rawBooks = r[12] || r[5] || rawPCode;

    // Split courses if multi-line
    const courseLines = rawCourse.split('\n').map((s) => s.trim()).filter(Boolean);
    const pCodeLines = rawPCode.split('\n').map((s) => s.trim()).filter(Boolean);
    const booksLines = rawBooks.split('\n').map((s) => s.trim()).filter(Boolean);

    const subCount = Math.max(courseLines.length, pCodeLines.length, booksLines.length, 1);

    for (let cIdx = 0; cIdx < subCount; cIdx++) {
      const pName = courseLines[cIdx] || courseLines[0] || 'Course';
      const pCode = pCodeLines[cIdx] || pCodeLines[0] || 'PRD-01';
      const bCodesStr = booksLines[cIdx] || booksLines[0] || pCode;

      // Split comma-separated books
      const bCodes = bCodesStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (bCodes.length === 0) {
        bCodes.push(pCode);
      }

      for (const bCode of bCodes) {
        excelRows.push({
          studentName,
          mobileNumber: mobile,
          email: email || '',
          trackingId,
          productCode: pCode,
          productName: pName,
          bookCode: bCode,
          bookName: getBookTitle(bCode, pName),
          quantity: 1,
        });
      }
    }
  }

  console.log(`Generated ${excelRows.length} distinct book items across orders.`);

  // Create clean Excel file
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Student Orders', {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { header: 'Student Name', key: 'studentName', width: 26 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 18 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Tracking ID', key: 'trackingId', width: 20 },
    { header: 'Product Code', key: 'productCode', width: 16 },
    { header: 'Product Name', key: 'productName', width: 38 },
    { header: 'Book Code', key: 'bookCode', width: 18 },
    { header: 'Book Name', key: 'bookName', width: 44 },
    { header: 'Quantity', key: 'quantity', width: 12 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 26;

  excelRows.forEach((r, idx) => {
    const row = sheet.addRow(r);
    row.height = 20;
    row.alignment = { vertical: 'middle' };
    row.getCell('quantity').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('productCode').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('bookCode').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('trackingId').alignment = { vertical: 'middle', horizontal: 'center' };

    if (idx % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };
    }
  });

  const localPath = path.resolve(__dirname, 'real_student_orders.xlsx');
  await workbook.xlsx.writeFile(localPath);
  console.log(`Saved clean Excel to: ${localPath}`);

  // Copy to Desktop
  const desktopPath = path.join('C:', 'Users', 'HP', 'Desktop', 'real_student_orders.xlsx');
  try {
    fs.copyFileSync(localPath, desktopPath);
    console.log(`Copied clean Excel to Desktop: ${desktopPath}`);
  } catch (err) {
    console.log('Desktop copy skipped:', err.message);
  }

  // Database Reset and Import
  console.log('2. Connecting to MongoDB to reset old data and import real data...');
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/book_tracking_db');
    console.log('MongoDB connected successfully.');

    // Remove old collections
    const collections = ['orders', 'importbatches', 'dispatchlogs', 'verificationattempts'];
    for (const c of collections) {
      try {
        await mongoose.connection.collection(c).deleteMany({});
        console.log(`Wiped old ${c} collection.`);
      } catch (err) {
        console.log(`Could not clear ${c}:`, err.message);
      }
    }

    // Get admin user ID
    let adminUser = await mongoose.connection.collection('users').findOne({ role: 'ADMIN' });
    const adminId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

    // Create Import Batch
    const batchResult = await mongoose.connection.collection('importbatches').insertOne({
      originalFileName: 'real_student_orders.xlsx',
      uploadedByUserId: adminId,
      status: 'COMPLETED',
      totalRows: excelRows.length,
      validRows: excelRows.length,
      invalidRows: 0,
      importedRows: excelRows.length,
      uploadedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const batchId = batchResult.insertedId;

    // Group rows by Tracking ID + Student Name
    const orderGroups = new Map();
    for (const row of excelRows) {
      const orderKey = `${row.trackingId}:::${row.studentName}`;
      if (!orderGroups.has(orderKey)) {
        orderGroups.set(orderKey, {
          studentName: row.studentName,
          mobileNumber: row.mobileNumber,
          email: row.email || null,
          trackingId: row.trackingId,
          items: [],
        });
      }
      orderGroups.get(orderKey).items.push({
        _id: new mongoose.Types.ObjectId(),
        productCode: row.productCode,
        productName: row.productName,
        bookCode: row.bookCode,
        bookName: row.bookName,
        requiredQuantity: row.quantity,
        dispatchedQuantity: 0,
      });
    }

    let orderCounter = 1;
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `ORD-${yy}${mm}`;

    const ordersToInsert = [];
    for (const ord of orderGroups.values()) {
      const orderCode = `${prefix}-${String(orderCounter).padStart(5, '0')}`;
      orderCounter++;

      ordersToInsert.push({
        orderCode,
        productCode: ord.items[0]?.productCode || 'PRD-01',
        studentName: ord.studentName,
        mobileNumber: ord.mobileNumber,
        email: ord.email,
        trackingId: ord.trackingId,
        importBatchId: batchId,
        items: ord.items,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (ordersToInsert.length > 0) {
      await mongoose.connection.collection('orders').insertMany(ordersToInsert);
      console.log(`Successfully created ${ordersToInsert.length} real orders with ${excelRows.length} books in MongoDB!`);
    }

    await mongoose.disconnect();
    console.log('MongoDB disconnected cleanly.');
  } catch (dbErr) {
    console.log('Local MongoDB operation note:', dbErr.message);
  }
}

run().catch(console.error);
