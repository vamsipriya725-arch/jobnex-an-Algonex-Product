import json
from ai_analyzer import analyze_resume_with_ai

resume_text = """BADIPATI ANIL KUMAR
Data Analyst  |  SQL  |  Python  |  Power BI  |  Excel
[Phone Number]  |  [Email Address]  |  [City, State]  |  [LinkedIn URL]  |  [GitHub URL]

PROFESSIONAL SUMMARY
Data Analyst with a B.E. in Computer Science and Engineering (2025) and hands-on experience in SQL, Python, Power BI and Excel. Completed an SQL with Python Developer internship at Algonex IT Solutions and a 10-week AICTE-EduSkills Data Engineering Virtual Internship supported by AWS Academy. Completed Microsoft's Power BI learning series (data preparation, DAX, data modeling, report design) and earned the Kaggle Python Coder badge. Strong in data cleaning, exploratory analysis, dashboard building and turning data into clear business insights. Seeking a Data Analyst role.

TECHNICAL SKILLS
Data Analysis: Data Cleaning, Data Transformation, Exploratory Data Analysis (EDA), Data Visualization, Dashboards, Reporting, KPI Tracking
Databases & SQL: SQL, MySQL, Relational Databases, Joins, Aggregations, Subqueries, Database Design
Programming: Python (Pandas, NumPy, Matplotlib), Machine Learning basics
BI & Spreadsheets: Power BI (Power Query, DAX, Data Modeling, Report Design, Copilot in Power BI), Microsoft Excel (Formulas, Pivot Tables, Charts)
Tools & Platforms: Git, GitHub, IBM Watson Studio, IBM watsonx Assistant, Jupyter Notebook, Kaggle
Soft Skills: Problem Solving, Logical Thinking, Communication, Interpersonal Skills, Teamwork

PROFESSIONAL EXPERIENCE
SQL with Python Developer Intern  |  Algonex IT Solutions, Bengaluru, Karnataka
- Wrote SQL queries to extract, filter, join and aggregate data from relational databases for analysis and reporting.
- Developed Python scripts to clean, transform and analyze data pulled from SQL databases.
- Applied database concepts such as tables, keys and relationships to keep data organized and consistent.
- Collaborated with the team to understand requirements and deliver working solutions within deadlines.

Data Engineering Virtual Intern  |  AICTE - EduSkills, supported by AWS Academy  |  Sep 2023 - Nov 2023
- Completed a 10-week virtual internship covering data engineering and cloud fundamentals on AWS.
- Earned the AICTE-EduSkills Certificate of Virtual Internship (NEAT Cell, AICTE).

PROJECTS
Smart Safety Crackers Factory using IoT and Machine Learning  |  Final-Year Major Project  |  2024 - 2025
- Designed an IoT-based safety monitoring system for a firecracker manufacturing unit to detect hazardous conditions and raise alerts.
- Collected and processed sensor data in Python and applied machine learning to identify unsafe conditions.
- Tools: Python, IoT sensors, Machine Learning.

Virtual Assistant Chatbot  |  IBM watsonx Assistant  |  2024
- Built and deployed a web-chat virtual assistant on IBM watsonx Assistant with a customized background and greeting.
- Configured conversation actions and tested the live preview through a shareable web link.
- Tools: IBM watsonx Assistant, IBM Watson Studio.

EDUCATION
B.E. Computer Science and Engineering  |  Nehru Institute of Engineering and Technology, Coimbatore  |  2021 - 2025
- Aggregate: 73.4%

CERTIFICATIONS
- Microsoft Learn - Prepare and Visualize Data with Microsoft Power BI (Oct 2026). Modules: Get Started with Microsoft Data Analytics; Get Data in Power BI; Clean, Transform and Load Data in Power BI; Choose a Power BI Model Framework; Create DAX Calculations in Semantic Models; Design Power BI Reports; Design Effective Reports in Power BI; Enhance Power BI Report Designs for the User Experience; Perform Analytics in Power BI; Prepare Data for Analysis with Power BI; Get Started Building with Power BI; Get Started with Copilot in Power BI.
- Python Coder Badge - Kaggle (Oct 2026)
- Data Analytics - LearnTube by CareerNinja, in association with @placementdrive (Mar 2024)
- IBM Watson Studio - IBM Career Education Program (Aug 2024)
- Data Engineering Virtual Internship - AICTE-EduSkills, AWS Academy (Nov 2023)
"""

jd_text = jd_text='''Skip to content
HomeIBM
IBM Careers
Login
< Back to search results
Intern / Associate Engineer
Bangalore, Karnataka, India
Entry Level
Email
X
LinkedIn
Apply now
Introduction
This is a pre-requisition to screen and assess applicants across roles of IBM for different line of business and can be but not limited to the below units

IT Services & Consulting: Delivers enterprise technology, hybrid cloud solutions, and consulting services. Infrastructure & AI: Focuses on enterprise AI agents, hybrid cloud architecture, and infrastructure innovation

Your role and responsibilities
Students completing Engineering Degree ( BE/B.Tech/ME/M.Tech) by May 2027 with Computer Science, Electrical and Electronics Specializations/Branch of Studies only can apply•Only Students with a current aggregate of 6/ 60% or above CGPA / Percentage in the highest degree pursuing can apply

Required education
Bachelor's Degree
Required technical and professional expertise
* Exposure to Academic Programs: Currently enrolled at a university or educational institution, or recently completed qualification.

* Understanding of Business Operations: Familiarity with basic business concepts and processes, gained through academic studies or previous internships.

* Basic Administrative Skills: Experience with administrative tasks, such as data entry, record-keeping, or document management.

* Foundational Communication Skills: Ability to effectively communicate ideas and collaborate with colleagues in a team environment.

* Application of Theoretical Knowledge: Exposure to applying theoretical concepts and skills learned in an academic setting to practical problems or projects.



These are basic call outs and actual required skills may differ

Preferred technical and professional experience
* Familiarity with Industry Trends: Exposure to current industry trends and developments in a specific field, gained through academic studies or personal projects, would be beneficial in this role.

* Basic Project Management: Experience working on small projects or contributing to group assignments, demonstrating an understanding of project planning and execution principles.

* Data Analysis Skills: Exposure to data analysis tools and techniques, such as data visualization or statistical analysis, would be advantageous in supporting business operations and projects.

These are high-level callouts, and the specific skills required may vary based on the role.

Years of Experience:0 - 0
ABOUT BUSINESS UNIT
IBM Corporate Headquarters (CHQ) team represents a variety of functions such as marketing, finance, legal, operations, HR, and more, all working together to solve some of the world's most complex problems, help our clients achieve success and build collaborative work environments for IBMers.
YOUR LIFE @ IBM
In a world where technology never stands still, we understand that, dedication to our clients success, innovation that matters, and trust and personal responsibility in all our relationships, lives in what we do as IBMers as we strive to be the catalyst that makes the world work better.

Being an IBMer means you’ll be able to learn and develop yourself and your career, you’ll be encouraged to be courageous and experiment everyday, all whilst having continuous trust and support in an environment where everyone can thrive whatever their personal or professional background.



Our IBMers are growth minded, always staying curious, open to feedback and learning new information and skills to constantly transform themselves and our company. They are trusted to provide on-going feedback to help other IBMers grow, as well as collaborate with colleagues keeping in mind a team focused approach to include different perspectives to drive exceptional outcomes for our customers. The courage our IBMers have to make critical decisions everyday is essential to IBM becoming the catalyst for progress, always embracing challenges with resources they have to hand, a can-do attitude and always striving for an outcome focused approach within everything that they do.

When applying to jobs of your interest, we recommend that you do so for those that match your experience and expertise. Our recruiters advise that you apply to not more than 3 roles in a year for the best candidate experience. For additional information about location requirements, please discuss with the recruiter following submission of your application.
Job Title
Intern / Associate Engineer
Job ID
137023
City / Township / Village
Bangalore
State / Province
Karnataka
Country
India
Work arrangement
Hybrid
Area of work
Cloud
Employment type
Regular
Position type
Entry Level
Travel required
No Travel
Company
(0063) IBM India Private Limited
Shift
General (daytime)
Is this role a commissionable/sales incentive based position?
No
Apply now

'''
if __name__ == "__main__":
    result = analyze_resume_with_ai(resume_text, jd_text)
    try:
        data = json.loads(result)
        print("Matchscore:", data["matched_score"])
        print("Matching skills:", data["matched_skills"])
        print("Missing skills:", data["missing_skills"])
        print("Suggestions:", data["suggestions"])
        print("Summary:", data["summary"])
    except (json.JSONDecodeError, KeyError) as error:
        print("Hey! Fix the json or column names")
        print("Hey! Error is:", error)