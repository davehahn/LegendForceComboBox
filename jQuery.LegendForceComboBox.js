/*   ##############   LegendForce Combo Box    ##################### */
/*
  This plugin creates live text input from a standard text input.  The results are displayed in a drop down box
  under the input field
*/

/*
Options:
  resultsContainerClass: "the class applied to the container under the input" - DEFAULT = 'comboBoxResults'
  idFieldName: "this is field name of the JSON search results that can be sent
                back to the server to select the result" - DEFAULT = 'Id'
  textFieldName: "the name of the field of the JSON results which will be used
                  to display search results in the results drop box box" - DEFAULT = 'Name'
  searchFunction: "the function which queries the server. It MUST return a jQuery
                   Deferred object. The query string (input text) is supplied to the function"
  quickSelectHandler: "function that get fired when the user 'arrows down' the search results
                       container when the entry is highlighted. The result of the query for
                       this item is supplied to the function"
  selectHandler: "function is called when the item in the search results is selected, by either
                  hitting enter, or clicking in the entry. The value of the idFieldName,
                  value of the textFieldName, and the entire result object for that item are
                  supplied to the function"
  onClose: "callback fired when ever the results container is closed"
*/

/*
Basic Example

HTML:
<input type="text" class="comboBox" />

JS:
$('.comboBox').legendForceComboBox({
    textFieldName: 'Name',
    idFeildName: 'Id',
    searchFunction: function(queryString) {
      return searchNow(queryString);
    },
    quickSelectHandler: function(result){
      console.log(result)
    },
    selectHandler: function(objectId, text, object){
      console.log(objectId);
      console.log(text);
      console.log(object);

      //here we can populate some html with the object data which will include any field queried during the seach function
      //or if a deeper second query is required ( say with child records ) we could fire another remote call here using the objectId

      //we will set the value in the text box to the text of the selected
      this.val(text);
    },
    onClose: function(){
      console.log("We have closed");
      $('#result').html('');
    }
  });

  function searchNow(queryString){
   console.log(queryString);
    var self;
    return $.Deferred( function() {
      self = this;

      //perform the remote server call to fetch some data
      //Example for Salesforce
      SomeController_OrExtension.someRemoteActionMethod(queryString, function(events, result){
        if(result.statusCode === 200)
        {
          self.resolve(result.result);
          console.log( result.result );
        }
      });
    })
  } // /searchNow

*/

/*
Example of Simple Salesforce APEX remoteAction method for the search function

public with sharing Class SomeController_OrExtension {
  .
  .
  .
  .

  @remoteAction
  public static List<Account> someRemoteActionMethod(String queryString)
  {
    String s = '%' + searchString + '%';
    return [SELECT Id, Name FROM  Account WHERE Name LIKE : s];
  }

}

*/


(function( $ ){

  var privates = {
    constructHtml: function() {
      var self = this,
          options = self.data('options'),
          $results = $('<div></div>').attr('class', options.resultsContainerClass).append('<ul></ul>');

      $results.on('click', 'a', function(e) {
      e.preventDefault();
      options.selectHandler.call(self, $(this).data('objectId'), $(this).html(), $(this).parent('li').data('resultObject') );
      methods.close.apply(self);
      });
      self.attr('autocomplete', 'off').after($results);
    },

    initKeyHandler: function() {
      var self = this,
          options = self.data('options'),
          $list,
          $selectedLi,
          $items,
          $listContainer,
          selectedPos;
          //contHeight;
      self.on({
        keydown: function(e) {
          if(!$listContainer){
            $listContainer = self.next();
            $list = $listContainer.children('ul:first');
          }
          //contHeight = $listContainer.height();
          //capture "ENTER" key
          if( e.keyCode === 13 ) {
            e.preventDefault();
            if($selectedLi){
              var $link = $selectedLi.find('a:first');
              //$(this).val( $link.html() );
              $link.click();
            }
          }
          //capture down arrow
          if( e.keyCode === 40 ){
            e.preventDefault();
            if($selectedLi){
                $selectedLi.removeClass('selected');
                next = $selectedLi.next();
                if(next.length > 0){
                    $selectedLi = next.addClass('selected');
                }else{
                   // $selectedLi = $items.eq(0).addClass('selected'); moves back to top
                   $selectedLi.addClass('selected');
                }
            }else{
                $selectedLi = $items.eq(0).addClass('selected');
            }
            privates.doQuickSelect.call(self, $selectedLi);
            selectedPos = $selectedLi.position().top;
            if(selectedPos <= 0){
              $listContainer.animate({'scrollTop': 0});
            }
            if($selectedLi.position().top >= $listContainer.height()){
              //we nee to scroll the list container down
              var newTop = $listContainer.scrollTop() + $selectedLi.outerHeight();
              $listContainer.scrollTop(newTop);
            }
          }// keycode 40
          //capture up arrow
          if( e.keyCode === 38){
            e.preventDefault();
            if($selectedLi){
                $selectedLi.removeClass('selected');
                next = $selectedLi.prev();
                if(next.length > 0){
                    $selectedLi = next.addClass('selected');
                }else{
                    $selectedLi.addClass('selected')
                    //$selectedLi = $items.last().addClass('selected'); moves to bottom
                }
            }else{
                $selectedLi = $items.last().addClass('selected');
            }
            privates.doQuickSelect.call(self, $selectedLi);
            selectedPos = $selectedLi.position().top;
            if($selectedLi.position().top < 0){
              //we nee to scroll the list container down
              var newTop = $listContainer.scrollTop() - $selectedLi.outerHeight();
              $listContainer.scrollTop(newTop);
            }
          }// keyCode 38
        },
        keyup: function(e){
          var text = $(this).val(),
           $results = $(this).next();

          if( [38, 40, 13].indexOf( e.keyCode ) >= 0 ){
            return false;
          }
          if( e.keyCode === 27 || text === '' || text === undefined || text.length < options.minTextLength){
           methods.close.apply(self);
          }
          else {
            $.when(options.searchFunction.call(self, text)).done(function(results) {

              $.when(privates.searchResultsHandler.call(self, results))
                .done( function() {
                  $items = $list.children('li');
                  $selectedLi = $list.find('.selected:first');
                  methods.open.call(self);
                });

            });

          }
        }// keyup
      });// /comboBox click handler
    },

    searchResultsHandler: function(results) {
      var self = this,
          options = self.data('options'),
          defer,
          $cont = self.next().children('ul');
      return $.Deferred( function() {
        defer = this;
        $cont.html('');
        if( $.isEmptyObject(results) ){
          methods.close.apply(self);
        }
        else {
          $.each(results, function() {
            $cont.append(
              $('<li></li>')
              .data('resultObject', this)
              .append(
                $('<a href="#"></a>').html( this[options.textFieldName] )
                  .data('objectId', this[options.idFieldName])
                  .attr('tabIndex', '-1')
                )
              );
          });
          $cont.children('li:first').addClass('selected');
          privates.doQuickSelect.call(self, $cont.children('li:first') );
        }
        defer.resolve();
      });
    },

    doQuickSelect: function($selectedLi){
      var self = this,
        options = this.data('options');
      if( options.quickSelectHandler != null && typeof(options.quickSelectHandler) === 'function'){
        options.quickSelectHandler.call(self, $selectedLi.data('resultObject'));
      }
    }
  },

  methods = {
     init : function( options ) {

        var self = this,
            $this,
            settings;

        settings = $.extend( {

          resultsContainerClass: 'comboBoxResults',
          minTextLength: 3,
          idFieldName: 'Id',
          textFieldName: 'Text',
          searchFunction: function() {},
          selectHandler: function() {},
          quickSelectHandler: null,
          onClose: function() {}
        }, options);

        self.data('options', settings);
        privates.constructHtml.apply(self);
        privates.initKeyHandler.apply(self);
    },
    open: function() {
      var self = this
          $results = self.next(),
          r_left = self.position().left,
          r_top = self.position().top + self.outerHeight(),
          r_minWidth = self.outerWidth() - 1;

      $results.css({'top': r_top,
                'left': r_left,
                'min-width': r_minWidth,
                'max-width': r_minWidth})
      .scrollTop(0);
      if(!$results.hasClass('active')){
        $results.addClass('active').show();
        $('body').on('click.closeComboBox', function(e) {
          methods.close.apply(self);
          $(this).off('click.closeComboBox');
        });
      }
    },
    close: function() {
      var self = this,
        options = self.data('options');
      self.next().removeClass('active').hide().children('ul').html('');
      if( typeof(options.onClose === 'function') ){
        options.onClose.call(self);
      }

    }
  };

  $.fn.legendForceComboBox = function( method ) {
    var args = arguments;

    return this.each(function () {
      var $this = $(this);
      if ( methods[method] ) {
        methods[method].apply( $this, Array.prototype.slice.call( args, 1 ));
      } else if ( typeof method === 'object' || ! method ) {
        methods.init.apply( $this, args );
      } else {
        $.error( 'Method ' +  method + ' does not exist on jQuery.legendForceComboBox' );
      }
    });

  };

})( jQuery );


