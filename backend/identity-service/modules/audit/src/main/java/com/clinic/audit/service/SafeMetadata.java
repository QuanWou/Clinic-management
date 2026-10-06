package com.clinic.audit.service;

import com.clinic.audit.api.ApiProblem;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;

@Component
public class SafeMetadata {
    private static final Pattern FORBIDDEN = Pattern.compile(
        "(?i).*(diagnosis|symptom|clinicaltext|clinical_note|note_text|result_text|prescription_text|patientname|full_name|fullname|phone|email|address|dateofbirth|date_of_birth|dob|nationalid|national_id|insurance).*"
    );

    public void validate(Map<String,Object> data){
        if(data==null)return;
        if(data.size()>32) throw ApiProblem.invalid("Metadata/event data has too many fields");
        walk(data,0);
    }

    private void walk(Object value,int depth){
        if(depth>4) throw ApiProblem.invalid("Metadata/event data nesting is too deep");
        if(value==null||value instanceof Number||value instanceof Boolean||value instanceof UUID)return;
        if(value instanceof String s){
            if(s.length()>256) throw ApiProblem.invalid("Metadata/event strings must be short safe references");
            return;
        }
        if(value instanceof Map<?,?> map){
            if(map.size()>32) throw ApiProblem.invalid("Metadata/event object has too many fields");
            for(var e:map.entrySet()){
                String key=String.valueOf(e.getKey());
                if(FORBIDDEN.matcher(key).matches())
                    throw ApiProblem.invalid("PHI/sensitive free-text field is not allowed in audit/event metadata: "+key);
                walk(e.getValue(),depth+1);
            }
            return;
        }
        if(value instanceof Collection<?> list){
            if(list.size()>32) throw ApiProblem.invalid("Metadata/event array has too many values");
            for(Object item:list)walk(item,depth+1);
            return;
        }
        throw ApiProblem.invalid("Unsupported metadata/event value type");
    }
}
