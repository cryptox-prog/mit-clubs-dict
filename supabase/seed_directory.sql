-- MIT Manipal directory seed. Run AFTER supabase/init.sql in SQL Editor.
-- Researched 2026-11-13. Sources per record: backend/data/directory-seed.json.
-- Curated starting directory, NOT a verified list of currently active organizations.
-- Institutional pages + MTTN archive; branding/activity may change. No events seeded.
-- ALL new entries have NULL dates, apply_link and icon_path: no recruitment enabled.
-- Eligibility is unknown: no open_to rows are invented.
-- Domain tags are editorial discovery labels, not verified recruitment departments.
-- Cultural groups social/media/literary clubs because schema currently has only
-- Technical/Cultural. University-wide MAHE bodies are marked in the source manifest.
-- Stable UUIDs make reruns safe; existing rows, dates and logos are NOT overwritten.
-- Run this seed BEFORE manual imports to avoid same-name entries with different IDs.
-- Logos are uploaded separately via backend/scripts/uploadLogos.js, never SQL.

begin;
-- Independent student projects have no parent club. No fabricated umbrella club.
-- Also safe for databases initialized with the earlier NOT NULL definition.
alter table public.student_projects alter column club_id drop not null;

-- Source: https://smude.edu.in/mit/mit-experience/student-welfare/technical-clubs.html
-- Source: https://freshers.manipalthetalk.org/articles/clubs-manipal-technical
-- Source: https://freshers.manipalthetalk.org/articles/clubs-mit-non-technical
-- Source: https://freshers.manipalthetalk.org/articles/clubs-manipal-technical-teams
-- Source: https://freshers.manipalthetalk.org/clubs
-- Source: https://www.manipal.edu/mit/mit-experience/mit-videos/major-student-projects.html.html

insert into public.domains(name) values
  ('AI'),
  ('Adventure'),
  ('Aerospace'),
  ('Agriculture'),
  ('Anime & Manga'),
  ('App Development'),
  ('Astronomy'),
  ('Automation'),
  ('Automotive'),
  ('Biomedical Engineering'),
  ('Biotechnology'),
  ('Chemical Engineering'),
  ('Civil Engineering'),
  ('Computer Science'),
  ('Consulting'),
  ('Cyber Security'),
  ('Dance'),
  ('Economics & Finance'),
  ('Electrical Engineering'),
  ('Electronics'),
  ('Entrepreneurship'),
  ('Environment'),
  ('Fashion'),
  ('Fine Arts'),
  ('Game Development'),
  ('Literature'),
  ('Mechanical Engineering'),
  ('Mechatronics'),
  ('Media'),
  ('Music'),
  ('Open Source'),
  ('Photography'),
  ('Product Development'),
  ('Public Speaking'),
  ('Renewable Energy'),
  ('Research'),
  ('Robotics'),
  ('Social Service'),
  ('Theatre'),
  ('Web Development')
on conflict (name) do nothing;

insert into public.clubs (id, name, description, club_kind, application_start, registration_deadline, apply_link, icon_path) values
  ('7030bcf4-42c4-5641-b837-1d9468287093', 'ACM Manipal', 'Computing community.', 'Technical', null, null, null, null),
  ('c272d574-9dd4-5fae-8157-f809823b84fd', 'ACM-W Manipal', 'Women in computing.', 'Technical', null, null, null, null),
  ('9e42ee45-b6fe-5ae6-b7b1-3faa25b0df19', 'Apple Developers’ Group', 'Apple-platform development.', 'Technical', null, null, null, null),
  ('aee23b37-ef01-5e76-bf7e-8c210099d1ba', 'ASCE Manipal', 'Civil engineering.', 'Technical', null, null, null, null),
  ('8163da0c-6a34-51d9-a142-e43196104da4', 'BMESI Manipal Chapter', 'Biomedical engineering.', 'Technical', null, null, null, null),
  ('02d073fc-c03b-521e-af99-455f5d8b09a6', 'Enactus Manipal', null, 'Technical', null, null, null, null),
  ('a3b6f41f-eb6f-57d2-8559-521cc66bc148', 'Economics and Finance Society of Manipal', 'Economics and finance.', 'Technical', null, null, null, null),
  ('deecea9d-6ff0-59b6-81e7-f7aa7c3c500a', 'Google Developer Student Clubs Manipal', null, 'Technical', null, null, null, null),
  ('a7612b92-0de0-5c60-8733-418649e4d7b8', 'IAESTE LC Manipal', 'Technical exchange opportunities.', 'Technical', null, null, null, null),
  ('9a9b3180-c3f5-572a-ad8b-7cd1e38abb45', 'IE Aerospace', 'Aerospace engineering.', 'Technical', null, null, null, null),
  ('09876e1d-98f6-5a43-9e70-313ba0aedd38', 'IE Biotechnology', 'Biotechnology community.', 'Technical', null, null, null, null),
  ('30bb5823-744d-522c-a970-1ee47a540efb', 'IE Civil', 'Civil engineering.', 'Technical', null, null, null, null),
  ('a16a686a-f2eb-5dd6-b0dd-d08a03484856', 'IECSE Manipal', 'Computing community.', 'Technical', null, null, null, null),
  ('3ada256e-8c34-58cf-801e-e9dd77d42b94', 'IE E&C Manipal', 'Electronics and communications.', 'Technical', null, null, null, null),
  ('6dec2502-a6e5-5069-ac1b-8e3ddef2ce47', 'IEEE EMBS Manipal', null, 'Technical', null, null, null, null),
  ('b0f964f0-a4dd-5ca6-b14c-02040c6fdd8f', 'IEEE Student Branch Manipal', null, 'Technical', null, null, null, null),
  ('1a0ea56a-33e3-5e69-afa0-c0d95f5f1425', 'IE E&E Manipal', 'Electrical engineering.', 'Technical', null, null, null, null),
  ('0955377c-f835-56f9-9daa-ae4f84430e97', 'IE Mechanical', 'Mechanical engineering.', 'Technical', null, null, null, null),
  ('00f90092-40b6-565d-8ce0-ac65e5dd1f32', 'IE Mechatronics', 'Mechatronics community.', 'Technical', null, null, null, null),
  ('ab5c65a8-d15d-5b28-bd25-7eacff9a70c5', 'IIChE Manipal', 'Chemical engineering.', 'Technical', null, null, null, null),
  ('c4d8f89b-cc04-5e07-8aee-69625ec52464', 'IOSD Manipal', 'Software development.', 'Technical', null, null, null, null),
  ('0df0c0ac-19b8-5c3e-8715-7b3168bead52', 'ISA Manipal', 'Automation and instrumentation.', 'Technical', null, null, null, null),
  ('a19ef9f4-84a9-5192-8f6a-3fc8c8d08edf', 'ISTE Manipal', 'Engineering learning.', 'Technical', null, null, null, null),
  ('08f029a5-e46d-5968-bd30-004d5b8edcb4', 'Lakshya — The Agri Club', 'Agricultural technology.', 'Technical', null, null, null, null),
  ('d5336cee-ec99-5898-add4-205f7d05c5cc', 'Lean In Manipal', null, 'Technical', null, null, null, null),
  ('af495e4b-c498-51a9-8c4e-b363989cf758', 'Manipal Information Security Team (MIST)', 'Information security.', 'Technical', null, null, null, null),
  ('9c643459-5fde-58f1-838f-40d3f163026e', 'Manipal Open Source Society (MOSS)', 'Open-source software.', 'Technical', null, null, null, null),
  ('59b234d9-74cb-5c15-ad9a-578fa92a2519', 'Research Society MIT', 'Student research.', 'Technical', null, null, null, null),
  ('2f70d25f-20e0-506e-8d0b-fb100661953d', 'SAE-IM Manipal', 'Automotive engineering.', 'Technical', null, null, null, null),
  ('fd485c68-9869-5471-8827-e718545dccaa', 'The Astronomy Club', 'Astronomy community.', 'Technical', null, null, null, null),
  ('a7672d36-a3c4-5240-b4c4-0a885896403a', 'The Data Alchemists', null, 'Technical', null, null, null, null),
  ('4358e981-5e31-5576-9013-d3c62f4018d5', 'Aaina Dramatics', 'Theatre and performance.', 'Cultural', null, null, null, null),
  ('0c3bdaa9-697f-58bf-ae56-609fe05ea37f', 'Ada Dramatics', 'Dramatics and street theatre.', 'Cultural', null, null, null, null),
  ('0f67a841-311d-5c04-af4d-0a008dbb2c10', 'Artpod', 'Fine arts.', 'Cultural', null, null, null, null),
  ('73335cc3-501d-521a-aa53-48c50310d451', 'Blank 101', 'Talks and public speaking.', 'Cultural', null, null, null, null),
  ('e45ccba1-50f0-59e6-b560-03b16f83617c', 'Blitzkrieg Crew', 'Hip-hop dance.', 'Cultural', null, null, null, null),
  ('cd937691-b93d-502e-97a0-1017273af07a', 'Burning Ice', 'Fashion and modelling.', 'Cultural', null, null, null, null),
  ('15500873-2a6b-583b-ae37-01700b8c9179', 'Chords & Co.', 'Music community.', 'Cultural', null, null, null, null),
  ('dd58d97a-fbab-50b2-9f0d-a063bd1f2f49', 'The Consulting Club at Manipal', 'Consulting and case studies.', 'Cultural', null, null, null, null),
  ('ee8ca47b-8554-561b-a180-7359f74bc20f', 'Goonj', 'Hindi literature.', 'Cultural', null, null, null, null),
  ('055d9325-a846-56a4-8172-5a1331fe0bbb', 'Literary, Debate and Quiz Club (LDQ)', 'Literature, debate and quizzes.', 'Cultural', null, null, null, null),
  ('387d5988-1c9d-518a-a378-2ce80434b3e7', 'Manga and Anime Club', 'Anime and manga.', 'Cultural', null, null, null, null),
  ('cbd6a840-6a93-5e3d-8264-7adfe0b75e81', 'Nudi', 'Kannada culture and literature.', 'Cultural', null, null, null, null),
  ('bd67925f-697a-544d-9991-ab2d5ce209cb', 'The Photography Club Manipal', 'Photography community.', 'Cultural', null, null, null, null),
  ('8eb0c419-4d1f-5f23-90c6-a4beaf87303e', 'Red-X Manipal', 'Adventure and service.', 'Cultural', null, null, null, null),
  ('3d503b86-9bc3-5e96-a9fd-ccf1314192a7', 'Rotaract Club of Manipal', 'Community service.', 'Cultural', null, null, null, null),
  ('bfbe7ec7-fc6b-5c38-8257-f3ba564dfdf0', 'SCIO Foundation', 'Social outreach.', 'Cultural', null, null, null, null),
  ('f13c04a7-4daf-5586-8b58-e892bd6806d6', 'The Showstoppers', 'Dance community.', 'Cultural', null, null, null, null),
  ('c2e1da82-b0c4-58b9-954c-865769a07e5d', 'The Think Tank', 'Ideas and discussion.', 'Cultural', null, null, null, null),
  ('dca619dd-df43-54e7-9460-db79e35a6d2d', 'ASME Manipal', 'Mechanical engineering.', 'Technical', null, null, null, null),
  ('336f403a-59d3-5ffe-8671-d0b019395dba', 'MIT Gaming Club', 'Gaming community.', 'Technical', null, null, null, null),
  ('43441287-0c3f-5b29-95ab-1993ae377960', 'Student Entrepreneurship Cell', 'Entrepreneurship activities.', 'Technical', null, null, null, null),
  ('adc3f4e3-1823-53a5-ab9f-085f8bdce16d', 'Teach Code for Good', 'Coding outreach.', 'Technical', null, null, null, null),
  ('8faf7d01-6f91-575e-abe9-6071e29c4f34', 'The Editorial Board', 'College yearbook.', 'Cultural', null, null, null, null),
  ('0a8e5a0e-d627-5af7-80d5-275c994b6850', 'The MIT Post', 'Campus media.', 'Cultural', null, null, null, null),
  ('4f60e112-d46b-5a2f-b860-8371f1d52bd8', 'Manipal the Talk Network (MTTN)', 'Student media.', 'Cultural', null, null, null, null),
  ('1d4e5e69-d7be-5e23-bddc-30654ce35dd2', 'E.C.H.O Manipal', 'Environmental conservation.', 'Cultural', null, null, null, null),
  ('3c53bb94-8921-5130-ba95-fe12dbc70908', 'AIESEC in MAHE', 'International student opportunities.', 'Cultural', null, null, null, null),
  ('8fcf058c-9eeb-51c2-8d59-b0255f0ff2e9', 'Volunteer Services Organisation — MAHE', 'Volunteering.', 'Cultural', null, null, null, null)
on conflict (id) do nothing;

insert into public.student_projects (id, title, description, club_id, application_start, registration_deadline, apply_link, icon_path) values
  ('af14ef96-e729-5b3b-ad07-64e781b8b2a2', 'AeroMIT', 'Model aircraft engineering.', null, null, null, null, null),
  ('691d8e0b-a36f-5349-af62-7b7910b9aee2', 'Cryptonite', 'Cybersecurity research and competitions.', null, null, null, null, null),
  ('d1f43f3e-3c7a-5391-8270-45be58c19123', 'Dronaid', 'Drones for healthcare.', null, null, null, null, null),
  ('46988dcb-dfd9-545e-b634-a64e942bf4f8', 'Formula Manipal', 'Formula-style racing cars.', null, null, null, null, null),
  ('3c13ce67-8e48-5bf1-8cf4-eb4bf61541f5', 'LoopMIT', 'Hyperloop vehicle development.', null, null, null, null, null),
  ('1765a235-d859-530d-9e6e-6679905acfc9', 'Manipal BioMachines', 'Synthetic biology.', null, null, null, null, null),
  ('bc92b5b0-2e06-51cb-989c-b053732199c0', 'Mars Rover Manipal', 'Planetary rover development.', null, null, null, null, null),
  ('15ec5482-6fa6-536f-bdef-79cf1f65acf6', 'MotoManipal', 'Electric motorcycles.', null, null, null, null, null),
  ('1572807c-736c-5c97-8761-1b029d0d336a', 'Parikshit', 'Student satellite development.', null, null, null, null, null),
  ('47968315-8b6b-5532-81ac-f8a9b54a9000', 'Project Manas', 'Autonomous vehicles.', null, null, null, null, null),
  ('57425bad-efca-5acd-b6d7-6da62d0777a7', 'RoboManipal', 'Robotics engineering.', null, null, null, null, null),
  ('711bf9b0-f77d-521b-82e4-5f9938889cb8', 'Robotics and Circuits', 'Robotics and embedded systems.', null, null, null, null, null),
  ('4b8e9e43-cdb1-59c7-b5a4-59daa0bc885c', 'R.U.G.V.E.D', 'Unmanned robotic systems.', null, null, null, null, null),
  ('608e1663-c4bc-5aa6-bee5-e44e9102a37e', 'SolarMobil', 'Solar-powered vehicles.', null, null, null, null, null),
  ('ee2d1532-fd87-5f84-86c5-eb56073d36df', 'S.W.A.R.M Robotics', 'Cooperative autonomous robots.', null, null, null, null, null),
  ('823619f2-f200-527f-8093-912de11f82d3', 'Team AUV Manipal', 'Underwater robotics.', null, null, null, null, null),
  ('fa979742-e37f-56f7-ad32-871b82c60e48', 'Team Combat Robotics', 'Combat robot engineering.', null, null, null, null, null),
  ('a45f12bf-2b36-5856-8f33-236d201469d5', 'Team Manipal Racing', 'Off-road vehicle engineering.', null, null, null, null, null),
  ('01f5c38e-d496-5468-a5f1-69e4610de7d4', 'thrustMIT', 'Student rocketry.', null, null, null, null, null),
  ('dd90febe-5d7d-583e-b42e-505ada0a1601', 'Team Synergy', 'Product prototyping.', null, null, null, null, null)
on conflict (id) do nothing;

insert into public.club_domains (club_id, domain_id)
select v.entity_id::uuid, d.id
from (values
  ('7030bcf4-42c4-5641-b837-1d9468287093', 'Computer Science'),
  ('c272d574-9dd4-5fae-8157-f809823b84fd', 'Computer Science'),
  ('9e42ee45-b6fe-5ae6-b7b1-3faa25b0df19', 'App Development'),
  ('aee23b37-ef01-5e76-bf7e-8c210099d1ba', 'Civil Engineering'),
  ('8163da0c-6a34-51d9-a142-e43196104da4', 'Biomedical Engineering'),
  ('a3b6f41f-eb6f-57d2-8559-521cc66bc148', 'Economics & Finance'),
  ('9a9b3180-c3f5-572a-ad8b-7cd1e38abb45', 'Aerospace'),
  ('09876e1d-98f6-5a43-9e70-313ba0aedd38', 'Biotechnology'),
  ('30bb5823-744d-522c-a970-1ee47a540efb', 'Civil Engineering'),
  ('a16a686a-f2eb-5dd6-b0dd-d08a03484856', 'Computer Science'),
  ('3ada256e-8c34-58cf-801e-e9dd77d42b94', 'Electronics'),
  ('1a0ea56a-33e3-5e69-afa0-c0d95f5f1425', 'Electrical Engineering'),
  ('0955377c-f835-56f9-9daa-ae4f84430e97', 'Mechanical Engineering'),
  ('00f90092-40b6-565d-8ce0-ac65e5dd1f32', 'Mechatronics'),
  ('ab5c65a8-d15d-5b28-bd25-7eacff9a70c5', 'Chemical Engineering'),
  ('c4d8f89b-cc04-5e07-8aee-69625ec52464', 'Web Development'),
  ('0df0c0ac-19b8-5c3e-8715-7b3168bead52', 'Automation'),
  ('08f029a5-e46d-5968-bd30-004d5b8edcb4', 'Agriculture'),
  ('af495e4b-c498-51a9-8c4e-b363989cf758', 'Cyber Security'),
  ('9c643459-5fde-58f1-838f-40d3f163026e', 'Open Source'),
  ('59b234d9-74cb-5c15-ad9a-578fa92a2519', 'Research'),
  ('2f70d25f-20e0-506e-8d0b-fb100661953d', 'Automotive'),
  ('fd485c68-9869-5471-8827-e718545dccaa', 'Astronomy'),
  ('4358e981-5e31-5576-9013-d3c62f4018d5', 'Theatre'),
  ('0c3bdaa9-697f-58bf-ae56-609fe05ea37f', 'Theatre'),
  ('0f67a841-311d-5c04-af4d-0a008dbb2c10', 'Fine Arts'),
  ('73335cc3-501d-521a-aa53-48c50310d451', 'Public Speaking'),
  ('e45ccba1-50f0-59e6-b560-03b16f83617c', 'Dance'),
  ('cd937691-b93d-502e-97a0-1017273af07a', 'Fashion'),
  ('15500873-2a6b-583b-ae37-01700b8c9179', 'Music'),
  ('dd58d97a-fbab-50b2-9f0d-a063bd1f2f49', 'Consulting'),
  ('ee8ca47b-8554-561b-a180-7359f74bc20f', 'Literature'),
  ('055d9325-a846-56a4-8172-5a1331fe0bbb', 'Literature'),
  ('055d9325-a846-56a4-8172-5a1331fe0bbb', 'Public Speaking'),
  ('387d5988-1c9d-518a-a378-2ce80434b3e7', 'Anime & Manga'),
  ('cbd6a840-6a93-5e3d-8264-7adfe0b75e81', 'Literature'),
  ('bd67925f-697a-544d-9991-ab2d5ce209cb', 'Photography'),
  ('8eb0c419-4d1f-5f23-90c6-a4beaf87303e', 'Adventure'),
  ('8eb0c419-4d1f-5f23-90c6-a4beaf87303e', 'Social Service'),
  ('3d503b86-9bc3-5e96-a9fd-ccf1314192a7', 'Social Service'),
  ('bfbe7ec7-fc6b-5c38-8257-f3ba564dfdf0', 'Social Service'),
  ('f13c04a7-4daf-5586-8b58-e892bd6806d6', 'Dance'),
  ('dca619dd-df43-54e7-9460-db79e35a6d2d', 'Mechanical Engineering'),
  ('336f403a-59d3-5ffe-8671-d0b019395dba', 'Game Development'),
  ('43441287-0c3f-5b29-95ab-1993ae377960', 'Entrepreneurship'),
  ('adc3f4e3-1823-53a5-ab9f-085f8bdce16d', 'Computer Science'),
  ('adc3f4e3-1823-53a5-ab9f-085f8bdce16d', 'Social Service'),
  ('8faf7d01-6f91-575e-abe9-6071e29c4f34', 'Media'),
  ('0a8e5a0e-d627-5af7-80d5-275c994b6850', 'Media'),
  ('4f60e112-d46b-5a2f-b860-8371f1d52bd8', 'Media'),
  ('1d4e5e69-d7be-5e23-bddc-30654ce35dd2', 'Environment'),
  ('8fcf058c-9eeb-51c2-8d59-b0255f0ff2e9', 'Social Service')
) as v(entity_id, domain_name)
join public.domains d on d.name = v.domain_name
on conflict do nothing;

insert into public.project_domains (project_id, domain_id)
select v.entity_id::uuid, d.id
from (values
  ('af14ef96-e729-5b3b-ad07-64e781b8b2a2', 'Aerospace'),
  ('691d8e0b-a36f-5349-af62-7b7910b9aee2', 'Cyber Security'),
  ('d1f43f3e-3c7a-5391-8270-45be58c19123', 'Aerospace'),
  ('d1f43f3e-3c7a-5391-8270-45be58c19123', 'AI'),
  ('46988dcb-dfd9-545e-b634-a64e942bf4f8', 'Automotive'),
  ('3c13ce67-8e48-5bf1-8cf4-eb4bf61541f5', 'Mechanical Engineering'),
  ('1765a235-d859-530d-9e6e-6679905acfc9', 'Biotechnology'),
  ('bc92b5b0-2e06-51cb-989c-b053732199c0', 'Robotics'),
  ('15ec5482-6fa6-536f-bdef-79cf1f65acf6', 'Automotive'),
  ('1572807c-736c-5c97-8761-1b029d0d336a', 'Aerospace'),
  ('47968315-8b6b-5532-81ac-f8a9b54a9000', 'AI'),
  ('47968315-8b6b-5532-81ac-f8a9b54a9000', 'Robotics'),
  ('57425bad-efca-5acd-b6d7-6da62d0777a7', 'Robotics'),
  ('711bf9b0-f77d-521b-82e4-5f9938889cb8', 'Robotics'),
  ('711bf9b0-f77d-521b-82e4-5f9938889cb8', 'Electronics'),
  ('4b8e9e43-cdb1-59c7-b5a4-59daa0bc885c', 'Robotics'),
  ('608e1663-c4bc-5aa6-bee5-e44e9102a37e', 'Automotive'),
  ('608e1663-c4bc-5aa6-bee5-e44e9102a37e', 'Renewable Energy'),
  ('ee2d1532-fd87-5f84-86c5-eb56073d36df', 'Robotics'),
  ('823619f2-f200-527f-8093-912de11f82d3', 'Robotics'),
  ('fa979742-e37f-56f7-ad32-871b82c60e48', 'Robotics'),
  ('a45f12bf-2b36-5856-8f33-236d201469d5', 'Automotive'),
  ('01f5c38e-d496-5468-a5f1-69e4610de7d4', 'Aerospace'),
  ('dd90febe-5d7d-583e-b42e-505ada0a1601', 'Product Development')
) as v(entity_id, domain_name)
join public.domains d on d.name = v.domain_name
on conflict do nothing;

commit;
