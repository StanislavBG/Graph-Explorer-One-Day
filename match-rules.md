# Match Rules for Graph Explorer

## Rule Structure
Each rule should define:
- Field(s) to compare
- Match criteria

## Match Criteria
- Use 'Exact' string comparare between the fields 

## Match Rule
- Rule-1: Salutation AND First Name AND Last Name AND Email
- - Rule-4: First Name AND Last Name AND Email
- - - Rule-5: First Name AND Email
- - - - Rule-7: Email
      OR
- - - Rule-6: Last Name AND Email
- - - - Rule-7: Email
OR
- Rule-2: Salutation AND First Name AND Last Name AND Phone
OR
- Rule-3: Salutation AND First Name AND Last Name AND Address-Line-1 AND City AND Country