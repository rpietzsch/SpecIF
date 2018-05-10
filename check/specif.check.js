/*	Schema and constraint checking for native SpecIF data in JSON format. 
	Requires: ajv 4.8 or higher.
	License: Apache 2.0 (http://www.apache.org/licenses/)
	Author: se@enso-managers.com, enso managers gmbh, Berlin (http://www.enso-managers.com)
	We appreciate any correction, comment or contribution here on GitHub or via e-mail to support@reqif.de            
*/
function checkSchema( schema, data ) {
	"use strict";
	// Check data using the supplied schema.
	// The return code uses properties similar to xhr, namely {status:900,statusText:"abc",responseText:"xyz"}
	// Requires: https://github.com/epoberezkin/ajv/releases/tag/4.8.0 or later 
	// ToDo: localize, see https://github.com/epoberezkin/ajv-i18n 

	let ajv = Ajv({allErrors: true});
	let validate = ajv.compile(schema);
		
	// check data against schema using the compiled validation routine:
	let valid = validate(data);
	
	return valid?{ status: 0, statusText: 'SpecIF schema has been checked successfully!' }
			:{ status: 901, statusText: 'SpecIF schema is violated', responseText: ajv.errorsText(validate.errors) }
}
function checkConstraints(data) {
	"use strict";
	// Check the constraints of the concrete values in 'data'.
	// SpecIF-Schema v0.10.x applies, so there are no items with multiple revisions.
	// The return code uses properties similar to xhr, namely {status:900,statusText:"abc",responseText:"xyz"}
	// ToDo: localize text and take it from language files.

	switch( data.specifVersion ) {
		case '0.10.0':
		case '0.10.1':
			return { status: 903, statusText: 'SpecIF version '+data.specifVersion+' is not supported by the program!' }
		case '0.10.2':
		case '0.10.3':
			var rClasses = 'resourceTypes',
				sClasses = 'statementTypes',
				hClasses = 'hierarchyTypes',
				pClasses = 'propertyTypes',
				rClass = 'resourceType',
				sClass = 'statementType',
				hClass = 'hierarchyType',
				pClass = 'propertyType',
				subClasses = 'subjectTypes',
				objClasses = 'objectTypes',
				sub = 'subject',
				obj = 'object';
			break;
		default:
			var rClasses = 'resourceClasses',
				sClasses = 'statementClasses',
				hClasses = 'hierarchyClasses',
				pClasses = 'propertyClasses',
				rClass = 'class',
				sClass = 'class',
				hClass = 'class',
				pClass = 'class',
				subClasses = 'subjectClasses',
				objClasses = 'objectClasses',
				sub = 'subject',
				obj = 'object'
	};

	var rc={},errL=[];

	// ids must be unique unless when used as a reference:
	rc = checkUniqueIds( data );
	if( rc.status>0 ) errL.push(rc);

	// dataTypes must respect certain constraints depending on their base type:
	rc = checkDataTypes( data.dataTypes );
	if( rc.status>0 ) errL.push(rc);
	// in case of resources, the value of "class" must be the id of a member of "resourceClasses":
	rc = checkTypes( data[rClasses], data.resources, rClass );
	if( rc.status>0 ) errL.push(rc);
	// in case of statements, the value of "class" must be the id of a member of "statementClasses":
	rc = checkTypes( data[sClasses], data.statements, sClass );
	if( rc.status>0 ) errL.push(rc);
	// in case of hierarchies, the value of "class" must be the id of a member of "hierarchyClasses":
	rc = checkTypes( data[hClasses], data.hierarchies, hClass );
	if( rc.status>0 ) errL.push(rc);

	// A propertyType's "dataType" must be the id of a member of "dataTypes":
	rc = checkPropTypes( data.dataTypes, data[rClasses] );
	if( rc.status>0 ) errL.push(rc);
	rc = checkPropTypes( data.dataTypes, data[sClasses] );
	if( rc.status>0 ) errL.push(rc);
	rc = checkPropTypes( data.dataTypes, data[hClasses] );
	if( rc.status>0 ) errL.push(rc);

	// statementClass' subjectClasses and objectClasses must be resourceClass ids:
	rc = checkStatementTypes( data[rClasses], data[sClasses] );
	if( rc.status>0 ) errL.push(rc);

	// property values ("content") must fit the respective class' range
	rc = checkPropValues( data[rClasses], data.resources, rClass );
	if( rc.status>0 ) errL.push(rc);
	rc = checkPropValues( data[sClasses], data.statements, sClass );
	if( rc.status>0 ) errL.push(rc);
	rc = checkPropValues( data[hClasses], data.hierarchies, hClass );
	if( rc.status>0 ) errL.push(rc);

	// statementClass' subject and object must be resource ids:
	rc = checkStatements( data.resources, data.statements );
	if( rc.status>0 ) errL.push(rc);

	// A hierarchy node's "resource" must be a resource id:
	for( var h=data.hierarchies.length-1; h>-1; h--) {
		rc = checkNodes( data.resources, data.hierarchies[h].nodes );
		if( rc.status>0 ) { errL.push(rc); break }
	};

	return errL.length<1?{ status: 0, statusText: 'SpecIF constraints have been checked successfully!' }
			:{ status: 902, statusText: 'SpecIF constraints are violated', responseText: errorsText(errL) };

	// The checking routines:
	function checkUniqueIds(iE) {
		// All identifiers 'id' must be unique (unless when used as a reference).
		let allIds=[],
			dId = duplicateId(iE.dataTypes);
		if( dId ) return {status:911, statusText: "dataType identifier '"+dId+"' is not unique"};
		dId = duplicateId(iE[rClasses]);
		if( dId ) return {status:912, statusText: rClass+" or property-class identifier '"+dId+"' is not unique"};
		dId = duplicateId(iE[sClasses]);
		if( dId ) return {status:913, statusText: sClass+" or property-class identifier '"+dId+"' is not unique"};
		dId = duplicateId(iE[hClasses]);
		if( dId ) return {status:914, statusText: hClass+" or property-class identifier '"+dId+"' is not unique"};
		dId = duplicateId(iE.resources);
		if( dId ) return {status:915, statusText: "resource identifier '"+dId+"' is not unique"};
		dId = duplicateId(iE.statements);
		if( dId ) return {status:916, statusText: "statement identifier '"+dId+"' is not unique"};
		dId = duplicateId(iE.hierarchies);
		if( dId ) return {status:917, statusText: "hierarchy identifier '"+dId+"' is not unique"};
		return {status:0, statusText: 'identifiers are unique'};

		function duplicateId(L) {
			// add every checked Id to allIds,
			// return 'null', only if all elements of L are not contained in allIds,
			// return the first id, which is contained in allIds (hence a duplicate):
			if(!L || !L.length) return null;
			var rc=null;
			for( var i=L.length-1;i>-1;i-- ) {
				// check the element's id:
				if( allIds.indexOf(L[i].id)>-1 ) return L[i].id;
				// in case of an enumerated dataType, check the values' identifiers, as well:
				if( L[i].values ) {
					rc = duplicateId(L[i].values);
					if( rc ) return rc
				};
				// check the identifiers of propertyClasses, as well:
				// (the instance's properties do not have an id ...)
				if( L[i][pClasses] ) {
					rc = duplicateId(L[i][pClasses]);
					if( rc ) return rc
				};
				// check the hierarchy's nodes recursively:
				if( L[i].nodes ) {
					rc = duplicateId(L[i].nodes);
					if( rc ) return rc
				}; 
				// all is fine, but add the latest id to the list for the next checking loops:
				allIds.push(L[i].id)
			};
			return null
		}
	}
	function checkDataTypes(L) {
		for( var i=L.length-1;i>-1;i-- ){
			switch(L[i].type) {
				case 'xhtml':
					if( data.specifVersion=='0.10.2' ) break;
				case 'xs:string': 
					// more restrictive than the schema, where maxLength is optional:
					if( !L[i].maxLength ) return {status:928, statusText: "string types must have maxLength>0"};
					break;
				case 'xs:double':
					// more restrictive than the schema, where accuracy is optional:
					if( !L[i].accuracy ) return {status:929, statusText: "double types must have accuracy>0"};
					// no break;
				case 'xs:integer':
					// more restrictive than the schema, where min and may are optional:
					if( L[i].min==undefined || L[i].max==undefined || L[i].min+1>L[i].max ) return {status:929, statusText: "number types must have min and max"}
			}						
		};
		return {status:0, statusText: "dataTypes are correct"}
	}
	function checkTypes(tL,iL,type) {  // type list, instance list
		// In case of resources, the value of "class" must be the id of a member of "resourceClasses". 
		// Similarly for statements and hierarchies.
		let tI=null;
		for( var i=iL.length-1;i>-1;i-- ){
			tI = indexById(tL, iL[i][type]);
			if(tI<0) return {status:903, statusText: "instance with identifier '"+iL[i].id+"' must reference a valid "+type }
		};
		return {status:0, statusText: "instance's "+type+"s reference valid types"}	
	}
	function checkPropTypes(dL,tL) {  // dataType list, type list
		let pT=null, dT=null;
		for( var i=tL.length-1;i>-1;i-- ){
			if( tL[i][pClasses] ) {
				for( var j=tL[i][pClasses].length-1;j>-1;j-- ) {
					pT = tL[i][pClasses][j];
					dT = itemById(dL,pT.dataType);
					// A propertyClass' "dataType" must be the id of a member of "dataTypes".
					// .. this is also checked in checkPropValues:
					if( !dT ) return {status:904, statusText: "property-class with identifier '"+pT.id+"' must reference a valid dataType"};
					// If a propertyType of base type "xs:enumeration" doesn't have a property 'multiple', multiple=false is assumed
				}
			}
		};
		return {status:0, statusText: "property-classes reference valid dataTypes"}
	}

	function checkStatementTypes(rTL,sTL) {	// resourceTypes, statementTypes
		// All statementClass' "subjectClasses" must be the id of a member of "resourceClasses". 
		// Similarly for "objectClasses".
		for( var i=sTL.length-1;i>-1;i-- ){
			if( !checkEls(rTL, sTL[i][subClasses]) ) return {status:906, statusText: subClasses+" of "+hClass+" with identifier '"+sTL[i].id+"' must reference a valid "+rClass };
			if( !checkEls(rTL, sTL[i][objClasses]) ) return {status:907, statusText: objClasses+" of "+hClass+" with identifier '"+sTL[i].id+"' must reference a valid "+rClass }
		};
		return {status:0, statusText: "statement-class' "+subClasses+" and "+objClasses+" reference valid "+rClasses };

		function checkEls(rTL,tL) {
			// no subjectClasses resp. objectClasses means all defined resourceClasses are eligible:
			if( tL ) { 
				// each value in tL must be the id of a member of rTL:
				for( var i=tL.length-1;i>-1;i-- ) {
					if(indexById(rTL, tL[i])<0) return false
				}
			};
			return true
		}
	}
	function checkStatements(rL,sL) {	// resources, statements
		// A statement's "subject" must be the id of a member of "resources". 
		// Similarly for "object".
		// (It has been checked before that any "resource" is indeed of type "resourceClass").
		for( var i=sL.length-1;i>-1;i-- ){
			if(indexById(rL, sL[i][sub])<0) 
				return {status:908, statusText: "subject of statement with identifier '"+sL[i].id+"' must reference a valid resource"};
			if(indexById(rL, sL[i][obj])<0) 
				return {status:909, statusText: "object of statement with identifier '"+sL[i].id+"' must reference a valid resource"};
//			if( sL[i][sub] == sL[i][obj] ) return {status:90X, statusText: ""}
		};
		return {status:0, statusText: "statement's subjects and objects reference valid resources"}
	}
	function checkPropValues(tL,iL,typ) {   // type list, instance list (resources, statements or hierarchies)
		let pT=null, dT=null, pV=null, iT=null;
		if( iL ) {
			for( var i=iL.length-1;i>-1;i-- ){
				if( iL[i].properties ) {
					iT = itemById(tL,iL[i][typ]); // the instance's type.
					// ToDo: error 919 is equal to 903, but there has been a case in which 919 has been raised. 
					if( !iT ) return {status:919, statusText: "instance with identifier '"+iL[i].id+"' must reference a valid "+typ }; 
					for( var a=iL[i].properties.length-1;a>-1;a-- ){
						// Property's propertyType must point to a propertyType of the respective type 
						pT = itemById(iT[pClasses],iL[i].properties[a][pClass]);
						if( !pT ) return {status:920, statusText: "properties of instance with identifier '"+iL[i].id+"' must reference a valid propertyType"}; 
						
						// Property's value ("content") must fit to the respective type's range
						pV = iL[i].properties[a].value;
						if( pV ) {
							// according to the schema, all property values are of type 'string', including boolean and numbers:
							dT = itemById(data.dataTypes,pT.dataType);
							if( !dT ) return {status:904, statusText: "property-class with identifier '"+pT.id+"' must reference a valid dataType"}; 
							switch(dT.type) {
								case 'xhtml':
								case 'xs:string': 
									if( pV.length>dT.maxLength ) return {status:921, statusText:"property of instance with identifier '"+iL[i].id+"': string must not exceed maxLength"}; 
									break;
								case 'xs:double':
	//								if( (pV*Math.pow(10,dT.accuracy)%1)==0 ) return {status:922,statusText:""};
									pV = parseFloat( pV );
									if( pV=='NaN' ) return {status:925, statusText:"property of instance with identifier '"+iL[i].id+"': invalid number"}; 
									if( pV<dT.min ) return {status:923, statusText:"property of instance with identifier '"+iL[i].id+"': number must be larger than min"};
									if( pV>dT.max ) return {status:924, statusText:"property of instance with identifier '"+iL[i].id+"': number must be smaller than max"}; 
									break;
								case 'xs:integer':
									pV = parseInt( pV );
									if( pV=='NaN' ) return {status:925, statusText:"property of instance with identifier '"+iL[i].id+"': invalid number"}; 
									if( pV<dT.min ) return {status:923, statusText:"property of instance with identifier '"+iL[i].id+"': number must be larger than min"};
									if( pV>dT.max ) return {status:924, statusText:"property of instance with identifier '"+iL[i].id+"': number must be smaller than max"}; 
									break;
								case 'xs:boolean':
									if( pV!='true' && pV!='false' ) return {status:925, statusText:"property of instance with identifier '"+iL[i].id+"': invalid boolean value"}; 
									break;
								case 'xs:enumeration':
									var vL=pV.split(',');
									// 'multiple' property at property-class supersedes 'multiple' at the dataType:
									if( vL.length>1 && !(pT.multiple || (pT.multiple==undefined && dT.multiple)) ) // logic expression is equivalent to 'multipleChoice(attrType)' ... the function is not used to avoid a dependency.
											return {status:926, statusText: "property of instance with identifier '"+iL[i].id+"': may not have more than one value"};
									// enumerated values in properties must be defined in the dataType of the corresponding propertyType
									for( var v=vL.length-1;v>-1;v-- ) {
										vL[v] = vL[v].trim();
										if( vL[v] && indexById( dT.values, vL[v] )<0 ) 
											return {status:927, statusText: "property of instance with identifier '"+iL[i].id+"': enumerated values must be defined by the respective property type"}
									}
							}						
						}
						// else: empty values are allowed, so no return with error code
					}
				}
			}
		};
		return {status:0, statusText: "propertyValues lie within their type's value ranges"}
	}
	function checkNodes(L,nds) {
		// Any node's "resource" must be the id of a member of "resources". 
		if( nds ) {
			var rc = null;
			for( var i=nds.length-1;i>-1;i-- ){
				if(indexById(L,nds[i].resource)<0) return {status:909, statusText: "hierarchy node with identifier '"+nds[i].id+"' must reference a valid resource"};	// check the node itself
				rc = checkNodes(L,nds[i].nodes);	// check references of next hierarchy levels recursively
				if(rc.status!=0) return rc	
			}
		};
		return {status:0, statusText: "hierarchy nodes reference valid resources"}		// all's fine!
	}
	function indexById(L,id) {
		if(!L||!id) return -1;
		// given the id of an element in a list, return it's index:
		id = id.trim();
		for( var i=L.length-1;i>-1;i-- )
			if( L[i].id === id ) return i;   // return list index 
		return -1
	}
	function itemById(L,id) {
		if(!L||!id) return null;
		// given the id of an element in a list, return the element itself:
		id = id.trim();
		for( var i=L.length-1;i>-1;i-- )
			if( L[i].id === id ) return L[i];  // return list item
		return null
	}
	function errorsText(eL) {
		var eT = '';
		eL.forEach( function(e) { eT += (eT.length?',\n':'')+e.statusText+' ('+status+')'} );
		return eT
	}
}
